import { Invoice } from '@domain/business/Billing';
import { DomainError } from '@domain/common/DomainError';
import { Money } from '@domain/common/values/Money';
import { FakeClock } from './support/FakeClock';

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

const draft = (clock: FakeClock, amount = 450): Invoice =>
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
    clock,
  );

describe('Invoice billing rules', () => {
  let clock: FakeClock;
  beforeEach(() => {
    clock = new FakeClock(new Date('2026-07-01T00:00:00.000Z'));
  });

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
        clock,
      ),
    ).toThrow(DomainError);
  });

  it('cannot record a payment before being issued', () => {
    const invoice = draft(clock);
    expect(() => invoice.recordPayment(Money.of(450), ACTOR, clock)).toThrow(DomainError);
  });

  it('derives PartiallyPaid then Paid as payments are applied', () => {
    const invoice = draft(clock, 450);
    invoice.issue(ACTOR, clock);
    invoice.recordPayment(Money.of(200), ACTOR, clock);
    expect(invoice.status).toBe('PartiallyPaid');
    expect(invoice.balance.amount).toBe(250);

    invoice.recordPayment(Money.of(250), ACTOR, clock);
    expect(invoice.status).toBe('Paid');
    expect(invoice.balance.isZero()).toBe(true);
  });

  it('never lets payments exceed the balance', () => {
    const invoice = draft(clock, 450);
    invoice.issue(ACTOR, clock);
    expect(() => invoice.recordPayment(Money.of(500), ACTOR, clock)).toThrow(DomainError);
  });

  it('applies a late fee into the total exactly once', () => {
    const invoice = draft(clock, 450);
    invoice.issue(ACTOR, clock);
    invoice.applyLateFee(Money.of(22.5), ACTOR, clock);
    expect(invoice.total.amount).toBe(472.5);
    expect(() => invoice.applyLateFee(Money.of(10), ACTOR, clock)).toThrow(DomainError);
  });

  it('marks overdue only once the due date has passed (driven by the clock)', () => {
    const invoice = draft(clock, 450);
    invoice.issue(ACTOR, clock);
    expect(() => invoice.markOverdue(ACTOR, clock)).toThrow(DomainError);
    clock.set(new Date('2026-07-10'));
    invoice.markOverdue(ACTOR, clock);
    expect(invoice.status).toBe('Overdue');
  });

  it('cannot cancel once payments exist', () => {
    const invoice = draft(clock, 450);
    invoice.issue(ACTOR, clock);
    invoice.recordPayment(Money.of(100), ACTOR, clock);
    expect(() => invoice.cancelInvoice(ACTOR, clock)).toThrow(DomainError);
  });
});
