import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';
import { DateRange } from '@domain/common/values/DateRange';
import { Money } from '@domain/common/values/Money';

export type LeaseStatus = 'Draft' | 'Active' | 'Expired' | 'Terminated' | 'Cancelled';
export type PaymentFrequency = 'Monthly' | 'Quarterly' | 'SemiAnnual' | 'Annual';

export interface LeaseContractProps extends EntityProps {
  contractNumber: string;
  apartmentId: string;
  ownerId: string;
  residentId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  currency: string;
  depositAmount: number;
  paymentFrequency: PaymentFrequency;
  lateFeePercent: number;
  graceDays: number;
  status: LeaseStatus;
  terminatedAt: Date | null;
  terminationReason: string | null;
}

/**
 * Aggregate root: the legal lease between an Owner (lessor) and a
 * Resident (lessee) over an Apartment.
 *
 * Lifecycle: Draft → Active → (Expired | Terminated)
 *            Draft → Cancelled
 * The "one active lease per apartment" rule is enforced both here (via
 * repository checks in the application layer) and physically by the
 * filtered unique index UQ_LeaseContracts_ActivePerApartment.
 */
export class LeaseContract extends AggregateRoot {
  readonly contractNumber: string;
  readonly apartmentId: string;
  readonly ownerId: string;
  readonly residentId: string;
  readonly startDate: Date;
  private _endDate: Date;
  private _monthlyRent: Money;
  private _depositAmount: Money;
  readonly paymentFrequency: PaymentFrequency;
  private _lateFeePercent: number;
  private _graceDays: number;
  private _status: LeaseStatus;
  private _terminatedAt: Date | null;
  private _terminationReason: string | null;

  private constructor(props: LeaseContractProps) {
    super(props);
    this.contractNumber = props.contractNumber;
    this.apartmentId = props.apartmentId;
    this.ownerId = props.ownerId;
    this.residentId = props.residentId;
    this.startDate = props.startDate;
    this._endDate = props.endDate;
    this._monthlyRent = Money.of(props.monthlyRent, props.currency);
    this._depositAmount = Money.of(props.depositAmount, props.currency);
    this.paymentFrequency = props.paymentFrequency;
    this._lateFeePercent = props.lateFeePercent;
    this._graceDays = props.graceDays;
    this._status = props.status;
    this._terminatedAt = props.terminatedAt;
    this._terminationReason = props.terminationReason;
  }

  static draft(
    tenantId: string,
    input: {
      contractNumber: string;
      apartmentId: string;
      ownerId: string;
      residentId: string;
      startDate: Date;
      endDate: Date;
      monthlyRent: number;
      currency?: string;
      depositAmount?: number;
      paymentFrequency?: PaymentFrequency;
      lateFeePercent?: number;
      graceDays?: number;
    },
    actorId: string | null,
    clock: IClock,
  ): LeaseContract {
    invariant(
      input.contractNumber.trim().length >= 3,
      'LEASE_NUMBER',
      'Contract number is required',
    );
    DateRange.of(input.startDate, input.endDate); // validates ordering
    const rent = Money.of(input.monthlyRent, input.currency ?? 'JOD');
    invariant(rent.isPositive(), 'LEASE_RENT', 'Monthly rent must be positive');
    const deposit = Money.of(input.depositAmount ?? 0, input.currency ?? 'JOD');
    invariant(!deposit.isNegative(), 'LEASE_DEPOSIT', 'Deposit cannot be negative');
    const lateFee = input.lateFeePercent ?? 0;
    invariant(lateFee >= 0 && lateFee <= 100, 'LEASE_LATE_FEE', 'Late fee must be 0–100%');
    const grace = input.graceDays ?? 5;
    invariant(
      Number.isInteger(grace) && grace >= 0 && grace <= 30,
      'LEASE_GRACE',
      'Grace days must be 0–30',
    );

    return new LeaseContract({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      contractNumber: input.contractNumber.trim(),
      apartmentId: input.apartmentId,
      ownerId: input.ownerId,
      residentId: input.residentId,
      startDate: input.startDate,
      endDate: input.endDate,
      monthlyRent: rent.amount,
      currency: rent.currency,
      depositAmount: deposit.amount,
      paymentFrequency: input.paymentFrequency ?? 'Monthly',
      lateFeePercent: lateFee,
      graceDays: grace,
      status: 'Draft',
      terminatedAt: null,
      terminationReason: null,
    });
  }

  static restore(props: LeaseContractProps): LeaseContract {
    return new LeaseContract(props);
  }

  get endDate(): Date {
    return this._endDate;
  }
  get monthlyRent(): Money {
    return this._monthlyRent;
  }
  get depositAmount(): Money {
    return this._depositAmount;
  }
  get lateFeePercent(): number {
    return this._lateFeePercent;
  }
  get graceDays(): number {
    return this._graceDays;
  }
  get status(): LeaseStatus {
    return this._status;
  }
  get terminatedAt(): Date | null {
    return this._terminatedAt;
  }
  get terminationReason(): string | null {
    return this._terminationReason;
  }
  get period(): DateRange {
    return DateRange.of(this.startDate, this._endDate);
  }

  /** Draft → Active. The application layer must first verify no other active lease exists. */
  activate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status === 'Draft', 'LEASE_NOT_DRAFT', 'Only draft leases can be activated');
    this._status = 'Active';
    this.touch(actorId, clock.now());
  }

  /** Draft → Cancelled (never took effect). */
  cancel(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status === 'Draft', 'LEASE_NOT_DRAFT', 'Only draft leases can be cancelled');
    this._status = 'Cancelled';
    this.touch(actorId, clock.now());
  }

  /** Active → Terminated (ended early, with a reason). Effective now. */
  terminate(reason: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Active',
      'LEASE_NOT_ACTIVE',
      'Only active leases can be terminated',
    );
    invariant(
      reason.trim().length >= 3,
      'LEASE_TERMINATION_REASON',
      'A termination reason is required',
    );
    const now = clock.now();
    this._status = 'Terminated';
    this._terminatedAt = now;
    this._terminationReason = reason.trim();
    this.touch(actorId, now);
  }

  /** Active → Expired once the end date has passed (scheduler use-case). */
  expire(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status === 'Active', 'LEASE_NOT_ACTIVE', 'Only active leases can expire');
    const now = clock.now();
    invariant(
      this._endDate.getTime() <= now.getTime(),
      'LEASE_NOT_ENDED',
      'Lease end date has not passed yet',
    );
    this._status = 'Expired';
    this.touch(actorId, now);
  }

  /** Extend an active lease (renewal in place). */
  extend(newEndDate: Date, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status === 'Active', 'LEASE_NOT_ACTIVE', 'Only active leases can be extended');
    invariant(
      newEndDate.getTime() > this._endDate.getTime(),
      'LEASE_EXTENSION',
      'New end date must be after the current end date',
    );
    this._endDate = newEndDate;
    this.touch(actorId, clock.now());
  }

  isCurrent(asOf: Date): boolean {
    return this._status === 'Active' && this.period.contains(asOf);
  }

  toProps(): LeaseContractProps {
    return {
      ...this.entityProps(),
      contractNumber: this.contractNumber,
      apartmentId: this.apartmentId,
      ownerId: this.ownerId,
      residentId: this.residentId,
      startDate: this.startDate,
      endDate: this._endDate,
      monthlyRent: this._monthlyRent.amount,
      currency: this._monthlyRent.currency,
      depositAmount: this._depositAmount.amount,
      paymentFrequency: this.paymentFrequency,
      lateFeePercent: this._lateFeePercent,
      graceDays: this._graceDays,
      status: this._status,
      terminatedAt: this._terminatedAt,
      terminationReason: this._terminationReason,
    };
  }
}
