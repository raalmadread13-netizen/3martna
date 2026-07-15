import { LeaseContract } from '@domain/business/LeaseContract';
import { DomainError } from '@domain/common/DomainError';

const TENANT = 'tenant-1';
const ACTOR = 'user-1';

const draft = (): LeaseContract =>
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
  );

describe('LeaseContract lifecycle', () => {
  it('starts as Draft with tenant scoping and money value objects', () => {
    const lease = draft();
    expect(lease.status).toBe('Draft');
    expect(lease.tenantId).toBe(TENANT);
    expect(lease.monthlyRent.amount).toBe(450);
    expect(lease.createdBy).toBe(ACTOR);
  });

  it('activates only from Draft', () => {
    const lease = draft();
    lease.activate(ACTOR);
    expect(lease.status).toBe('Active');
    expect(() => lease.activate(ACTOR)).toThrow(DomainError);
  });

  it('terminates an active lease with a reason and stamps the time', () => {
    const lease = draft();
    lease.activate(ACTOR);
    const at = new Date('2026-06-01');
    lease.terminate('Tenant relocated', at, ACTOR);
    expect(lease.status).toBe('Terminated');
    expect(lease.terminatedAt).toEqual(at);
    expect(lease.terminationReason).toBe('Tenant relocated');
  });

  it('requires a reason to terminate', () => {
    const lease = draft();
    lease.activate(ACTOR);
    expect(() => lease.terminate('', new Date(), ACTOR)).toThrow(DomainError);
  });

  it('cannot terminate a draft lease', () => {
    expect(() => draft().terminate('too soon', new Date(), ACTOR)).toThrow(DomainError);
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
      ),
    ).toThrow(DomainError);
  });

  it('expires only after the end date has passed', () => {
    const lease = draft();
    lease.activate(ACTOR);
    expect(() => lease.expire(new Date('2026-06-01'), ACTOR)).toThrow(DomainError);
    lease.expire(new Date('2027-01-01'), ACTOR);
    expect(lease.status).toBe('Expired');
  });
});
