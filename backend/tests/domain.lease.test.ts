import { LeaseContract } from '@domain/business/LeaseContract';
import { DomainError } from '@domain/common/DomainError';
import { FakeClock } from './support/FakeClock';

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

const draft = (clock: FakeClock): LeaseContract =>
  LeaseContract.draft(
    TENANT,
    {
      contractNumber: 'CTR-2026-0001',
      apartmentId: 'apt-1',
      ownerId: 'owner-1',
      residentId: 'res-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      monthlyRent: 450,
    },
    ACTOR,
    clock,
  );

describe('LeaseContract lifecycle', () => {
  let clock: FakeClock;
  beforeEach(() => {
    clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('starts as Draft with tenant scoping and money value objects', () => {
    const lease = draft(clock);
    expect(lease.status).toBe('Draft');
    expect(lease.tenantId).toBe(TENANT);
    expect(lease.monthlyRent.amount).toBe(450);
    expect(lease.createdBy).toBe(ACTOR);
    // createdAt comes from the injected clock, not the wall clock
    expect(lease.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('stamps updatedAt from the clock on mutation', () => {
    const lease = draft(clock);
    clock.advance(60_000);
    lease.activate(ACTOR, clock);
    expect(lease.status).toBe('Active');
    expect(lease.updatedAt.toISOString()).toBe('2026-01-01T00:01:00.000Z');
  });

  it('activates only from Draft', () => {
    const lease = draft(clock);
    lease.activate(ACTOR, clock);
    expect(() => lease.activate(ACTOR, clock)).toThrow(DomainError);
  });

  it('terminates an active lease with a reason and stamps the time from the clock', () => {
    const lease = draft(clock);
    lease.activate(ACTOR, clock);
    clock.set(new Date('2026-06-01T09:00:00.000Z'));
    lease.terminate('Tenant relocated', ACTOR, clock);
    expect(lease.status).toBe('Terminated');
    expect(lease.terminatedAt?.toISOString()).toBe('2026-06-01T09:00:00.000Z');
    expect(lease.terminationReason).toBe('Tenant relocated');
  });

  it('requires a reason to terminate', () => {
    const lease = draft(clock);
    lease.activate(ACTOR, clock);
    expect(() => lease.terminate('', ACTOR, clock)).toThrow(DomainError);
  });

  it('cannot terminate a draft lease', () => {
    expect(() => draft(clock).terminate('too soon', ACTOR, clock)).toThrow(DomainError);
  });

  it('rejects an end date before the start date at creation', () => {
    expect(() =>
      LeaseContract.draft(
        TENANT,
        {
          contractNumber: 'CTR-X',
          apartmentId: 'apt-1',
          ownerId: 'owner-1',
          residentId: 'res-1',
          startDate: new Date('2026-12-31'),
          endDate: new Date('2026-01-01'),
          monthlyRent: 450,
        },
        ACTOR,
        clock,
      ),
    ).toThrow(DomainError);
  });

  it('expires only after the end date has passed (driven by the clock)', () => {
    const lease = draft(clock);
    lease.activate(ACTOR, clock);
    clock.set(new Date('2026-06-01'));
    expect(() => lease.expire(ACTOR, clock)).toThrow(DomainError);
    clock.set(new Date('2027-01-01'));
    lease.expire(ACTOR, clock);
    expect(lease.status).toBe('Expired');
  });
});
