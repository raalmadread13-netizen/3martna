import { Invoice } from '@domain/business/Billing';
import { DomainError } from '@domain/common/DomainError';
import { Money } from '@domain/common/values/Money';

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

const draft = (amount = 450): Invoice =>
  Invoice.draft(
    TENANT,
    {
      invoiceNumber: 'INV-2026-0001',
      apartmentId: 'apt-1',
      residentId: 'res-1',
      issueDate: new Date('2026-07-01'),
      dueDate: new Date('2026-07-05'),
      amount,
    },
    ACTOR,
  );

describe('Invoice billing rules', () => {
  it('must be billed to exactly one party', () => {
    expect(() =>
      Invoice.draft(
        TENANT,
        {
          invoiceNumber: 'INV-X',
          apartmentId: 'apt-1',
          residentId: 'res-1',
          ownerId: 'owner-1', // both → invalid
          issueDate: new Date('2026-07-01'),
          dueDate: new Date('2026-07-05'),
          amount: 100,
        },
        ACTOR,
      ),
    ).toThrow(DomainError);
  });

  it('cannot record a payment before being issued', () => {
    const invoice = draft();
    expect(() => invoice.recordPayment(Money.of(450), ACTOR)).toThrow(DomainError);
  });

  it('derives PartiallyPaid then Paid as payments are applied', () => {
    const invoice = draft(450);
    invoice.issue(ACTOR);
    invoice.recordPayment(Money.of(200), ACTOR);
    expect(invoice.status).toBe('PartiallyPaid');
    expect(invoice.balance.amount).toBe(250);

    invoice.recordPayment(Money.of(250), ACTOR);
    expect(invoice.status).toBe('Paid');
    expect(invoice.balance.isZero()).toBe(true);
  });

  it('never lets payments exceed the balance', () => {
    const invoice = draft(450);
    invoice.issue(ACTOR);
    expect(() => invoice.recordPayment(Money.of(500), ACTOR)).toThrow(DomainError);
  });

  it('applies a late fee into the total exactly once', () => {
    const invoice = draft(450);
    invoice.issue(ACTOR);
    invoice.applyLateFee(Money.of(22.5), ACTOR);
    expect(invoice.total.amount).toBe(472.5);
    expect(() => invoice.applyLateFee(Money.of(10), ACTOR)).toThrow(DomainError);
  });

  it('cannot cancel once payments exist', () => {
    const invoice = draft(450);
    invoice.issue(ACTOR);
    invoice.recordPayment(Money.of(100), ACTOR);
    expect(() => invoice.cancelInvoice(ACTOR)).toThrow(DomainError);
  });
});
