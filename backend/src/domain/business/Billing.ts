import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';
import { Money } from '@domain/common/values/Money';

export type InvoiceType =
  'Rent' | 'Maintenance' | 'Utility' | 'Service' | 'LateFee' | 'Deposit' | 'Other';
export type InvoiceStatus = 'Draft' | 'Issued' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'BankTransfer' | 'Card' | 'Cheque';
export type PaymentStatus = 'Pending' | 'Confirmed' | 'Rejected';

/* ---------------------------- Invoice --------------------------- */

export interface InvoiceProps extends EntityProps {
  invoiceNumber: string;
  leaseContractId: string | null;
  apartmentId: string;
  residentId: string | null;
  ownerId: string | null;
  invoiceType: InvoiceType;
  periodStart: Date | null;
  periodEnd: Date | null;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  lateFee: number;
  currency: string;
  status: InvoiceStatus;
  notes: string | null;
}

/**
 * Aggregate root: a bill issued to exactly one party (resident XOR owner).
 * Payment application happens through recordPayment — status is always
 * derived, never written directly.
 */
export class Invoice extends AggregateRoot {
  readonly invoiceNumber: string;
  readonly leaseContractId: string | null;
  readonly apartmentId: string;
  readonly residentId: string | null;
  readonly ownerId: string | null;
  readonly invoiceType: InvoiceType;
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
  readonly issueDate: Date;
  readonly dueDate: Date;
  private _amount: Money;
  private _lateFee: Money;
  private _status: InvoiceStatus;
  private _notes: string | null;
  /** Confirmed payments applied so far (rehydrated by the repository). */
  private _paidAmount: Money;

  private constructor(props: InvoiceProps, paidAmount: Money) {
    super(props);
    this.invoiceNumber = props.invoiceNumber;
    this.leaseContractId = props.leaseContractId;
    this.apartmentId = props.apartmentId;
    this.residentId = props.residentId;
    this.ownerId = props.ownerId;
    this.invoiceType = props.invoiceType;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.issueDate = props.issueDate;
    this.dueDate = props.dueDate;
    this._amount = Money.of(props.amount, props.currency);
    this._lateFee = Money.of(props.lateFee, props.currency);
    this._status = props.status;
    this._notes = props.notes;
    this._paidAmount = paidAmount;
  }

  static draft(
    tenantId: string,
    input: {
      invoiceNumber: string;
      apartmentId: string;
      residentId?: string | null;
      ownerId?: string | null;
      leaseContractId?: string | null;
      invoiceType?: InvoiceType;
      periodStart?: Date | null;
      periodEnd?: Date | null;
      issueDate: Date;
      dueDate: Date;
      amount: number;
      currency?: string;
      notes?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Invoice {
    invariant(
      input.invoiceNumber.trim().length >= 3,
      'INVOICE_NUMBER',
      'Invoice number is required',
    );
    const billedToResident = input.residentId != null;
    const billedToOwner = input.ownerId != null;
    invariant(
      billedToResident !== billedToOwner,
      'INVOICE_BILLED_PARTY',
      'Invoice must be billed to exactly one party (resident or owner)',
    );
    invariant(
      input.dueDate.getTime() >= input.issueDate.getTime(),
      'INVOICE_DATES',
      'Due date cannot precede issue date',
    );
    if (input.periodStart && input.periodEnd) {
      invariant(
        input.periodEnd.getTime() >= input.periodStart.getTime(),
        'INVOICE_PERIOD',
        'Period end cannot precede period start',
      );
    }
    const amount = Money.of(input.amount, input.currency ?? 'JOD');
    invariant(!amount.isNegative(), 'INVOICE_AMOUNT', 'Amount cannot be negative');

    return new Invoice(
      {
        ...newEntityProps(newId(), tenantId, actorId, clock.now()),
        invoiceNumber: input.invoiceNumber.trim(),
        leaseContractId: input.leaseContractId ?? null,
        apartmentId: input.apartmentId,
        residentId: input.residentId ?? null,
        ownerId: input.ownerId ?? null,
        invoiceType: input.invoiceType ?? 'Rent',
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        amount: amount.amount,
        lateFee: 0,
        currency: amount.currency,
        status: 'Draft',
        notes: input.notes?.trim() || null,
      },
      Money.zero(amount.currency),
    );
  }

  static restore(props: InvoiceProps, paidAmount: number): Invoice {
    return new Invoice(props, Money.of(paidAmount, props.currency));
  }

  get amount(): Money {
    return this._amount;
  }
  get lateFee(): Money {
    return this._lateFee;
  }
  get total(): Money {
    return this._amount.add(this._lateFee);
  }
  get paidAmount(): Money {
    return this._paidAmount;
  }
  get balance(): Money {
    return this.total.subtract(this._paidAmount);
  }
  get status(): InvoiceStatus {
    return this._status;
  }
  get notes(): string | null {
    return this._notes;
  }

  /** Draft → Issued: the invoice becomes payable. */
  issue(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status === 'Draft', 'INVOICE_NOT_DRAFT', 'Only draft invoices can be issued');
    invariant(this.total.isPositive(), 'INVOICE_ZERO', 'Cannot issue a zero invoice');
    this._status = 'Issued';
    this.touch(actorId, clock.now());
  }

  /** Apply a confirmed payment amount; derives PartiallyPaid/Paid. */
  recordPayment(amount: Money, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status !== 'Draft' && this._status !== 'Cancelled',
      'INVOICE_NOT_PAYABLE',
      `Cannot pay a ${this._status.toLowerCase()} invoice`,
    );
    invariant(amount.isPositive(), 'PAYMENT_AMOUNT', 'Payment amount must be positive');
    invariant(
      this.balance.gte(amount),
      'PAYMENT_EXCEEDS_BALANCE',
      'Payment exceeds the remaining balance',
    );
    this._paidAmount = this._paidAmount.add(amount);
    this._status = this.balance.isZero() ? 'Paid' : 'PartiallyPaid';
    this.touch(actorId, clock.now());
  }

  /** Apply the contractual late fee once the grace period has lapsed. */
  applyLateFee(fee: Money, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Issued' || this._status === 'Overdue' || this._status === 'PartiallyPaid',
      'INVOICE_NOT_PAYABLE',
      'Late fees apply to unpaid, issued invoices only',
    );
    invariant(fee.isPositive(), 'LATE_FEE_AMOUNT', 'Late fee must be positive');
    invariant(this._lateFee.isZero(), 'LATE_FEE_APPLIED', 'A late fee has already been applied');
    this._lateFee = fee;
    this.touch(actorId, clock.now());
  }

  /** Issued/PartiallyPaid + past due → Overdue (scheduler use-case). */
  markOverdue(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Issued' || this._status === 'PartiallyPaid',
      'INVOICE_NOT_PAYABLE',
      'Only issued, unpaid invoices can become overdue',
    );
    const now = clock.now();
    invariant(this.dueDate.getTime() < now.getTime(), 'INVOICE_NOT_DUE', 'Invoice is not past due');
    this._status = 'Overdue';
    this.touch(actorId, now);
  }

  /** Cancel — only before any money has been applied. */
  cancelInvoice(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status !== 'Paid', 'INVOICE_PAID', 'Paid invoices cannot be cancelled');
    invariant(this._paidAmount.isZero(), 'INVOICE_HAS_PAYMENTS', 'Invoice already has payments');
    this._status = 'Cancelled';
    this.touch(actorId, clock.now());
  }

  toProps(): InvoiceProps {
    return {
      ...this.entityProps(),
      invoiceNumber: this.invoiceNumber,
      leaseContractId: this.leaseContractId,
      apartmentId: this.apartmentId,
      residentId: this.residentId,
      ownerId: this.ownerId,
      invoiceType: this.invoiceType,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      issueDate: this.issueDate,
      dueDate: this.dueDate,
      amount: this._amount.amount,
      lateFee: this._lateFee.amount,
      currency: this._amount.currency,
      status: this._status,
      notes: this._notes,
    };
  }
}

/* ---------------------------- Payment --------------------------- */

export interface PaymentProps extends EntityProps {
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  status: PaymentStatus;
  paidAt: Date;
  receivedByUserId: string | null;
  notes: string | null;
}

/**
 * Aggregate root: money received against an invoice. Financial records
 * are append-only — a wrong payment is Rejected, never deleted.
 */
export class Payment extends AggregateRoot {
  readonly invoiceId: string;
  readonly method: PaymentMethod;
  readonly referenceNumber: string | null;
  readonly paidAt: Date;
  readonly receivedByUserId: string | null;
  private _amount: Money;
  private _status: PaymentStatus;
  private _notes: string | null;

  private constructor(props: PaymentProps) {
    super(props);
    this.invoiceId = props.invoiceId;
    this.method = props.method;
    this.referenceNumber = props.referenceNumber;
    this.paidAt = props.paidAt;
    this.receivedByUserId = props.receivedByUserId;
    this._amount = Money.of(props.amount, props.currency);
    this._status = props.status;
    this._notes = props.notes;
  }

  static record(
    tenantId: string,
    input: {
      invoiceId: string;
      amount: number;
      currency?: string;
      method: PaymentMethod;
      referenceNumber?: string | null;
      paidAt?: Date;
      receivedByUserId?: string | null;
      notes?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Payment {
    const amount = Money.of(input.amount, input.currency ?? 'JOD');
    invariant(amount.isPositive(), 'PAYMENT_AMOUNT', 'Payment amount must be positive');
    invariant(
      input.method !== 'BankTransfer' || (input.referenceNumber?.trim().length ?? 0) > 0,
      'PAYMENT_REFERENCE',
      'Bank transfers require a reference number',
    );
    const now = clock.now();
    return new Payment({
      ...newEntityProps(newId(), tenantId, actorId, now),
      invoiceId: input.invoiceId,
      amount: amount.amount,
      currency: amount.currency,
      method: input.method,
      referenceNumber: input.referenceNumber?.trim() || null,
      status: 'Pending',
      paidAt: input.paidAt ?? now,
      receivedByUserId: input.receivedByUserId ?? null,
      notes: input.notes?.trim() || null,
    });
  }

  static restore(props: PaymentProps): Payment {
    return new Payment(props);
  }

  get amount(): Money {
    return this._amount;
  }
  get status(): PaymentStatus {
    return this._status;
  }
  get notes(): string | null {
    return this._notes;
  }

  confirm(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Pending',
      'PAYMENT_NOT_PENDING',
      'Only pending payments can be confirmed',
    );
    this._status = 'Confirmed';
    this.touch(actorId, clock.now());
  }

  reject(reason: string | null, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Pending',
      'PAYMENT_NOT_PENDING',
      'Only pending payments can be rejected',
    );
    this._status = 'Rejected';
    if (reason) this._notes = reason.trim();
    this.touch(actorId, clock.now());
  }

  toProps(): PaymentProps {
    return {
      ...this.entityProps(),
      invoiceId: this.invoiceId,
      amount: this._amount.amount,
      currency: this._amount.currency,
      method: this.method,
      referenceNumber: this.referenceNumber,
      status: this._status,
      paidAt: this.paidAt,
      receivedByUserId: this.receivedByUserId,
      notes: this._notes,
    };
  }
}
