import { LeaseContract } from '@domain/business/LeaseContract';
import { Occupancy } from '@domain/business/Occupancy';
import { Resident } from '@domain/business/Resident';
import {
  InMemoryIdempotencyStore,
  InMemoryLeaseContractRepository,
  InMemoryOccupancyRepository,
  InMemoryResidentRepository,
} from './fakes.occupancy';
import { FakeClock } from './support/FakeClock';

/*
 * Repository + idempotency-store contract tests for the Occupancy module.
 * The SQL implementations mirror the same semantics (keyset predicates,
 * tenant scoping, soft-delete filtering) against dbo.Residents,
 * dbo.LeaseContracts, dbo.Occupancies and dbo.IdempotencyKeys.
 */

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const APARTMENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const APARTMENT_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OWNER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const clock = new FakeClock();

const makeResident = (fullName: string, phone: string, tenantId = TENANT_A): Resident =>
  Resident.register(tenantId, { fullName, phoneNumber: phone }, ACTOR, clock);

const makeLease = (
  contractNumber: string,
  start: string,
  end: string,
  options: {
    residentId?: string;
    apartmentId?: string;
    activate?: boolean;
    tenantId?: string;
  } = {},
): LeaseContract => {
  const lease = LeaseContract.draft(
    options.tenantId ?? TENANT_A,
    {
      contractNumber,
      apartmentId: options.apartmentId ?? APARTMENT,
      ownerId: OWNER,
      residentId: options.residentId ?? 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      startDate: new Date(start),
      endDate: new Date(end),
      monthlyRent: 300,
    },
    ACTOR,
    clock,
  );
  if (options.activate !== false) lease.activate(ACTOR, clock);
  return lease;
};

describe('Resident repository — cursor contract', () => {
  let repo: InMemoryResidentRepository;
  beforeEach(() => {
    repo = new InMemoryResidentRepository();
  });

  it('walks pages without duplicates or gaps and honors descending order', async () => {
    const names = ['Aisha', 'Bilal', 'Carmen', 'Dina', 'Elias'];
    for (const [index, name] of names.entries()) {
      await repo.save(makeResident(name, `+96279000000${index}`));
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await repo.listCursor(TENANT_A, {
        limit: 2,
        sortBy: 'fullName',
        sortDir: 'desc',
        cursor,
      });
      seen.push(...page.data.map((r) => r.fullName));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual(['Elias', 'Dina', 'Carmen', 'Bilal', 'Aisha']);
  });

  it('searches across name, phone and email and isolates tenants', async () => {
    await repo.save(makeResident('Sara Khalil', '+962790001111'));
    await repo.save(makeResident('Foreign Person', '+962790002222', TENANT_B));

    const byPhone = await repo.listCursor(TENANT_A, {
      limit: 10,
      sortBy: 'fullName',
      sortDir: 'asc',
      search: '790001111',
    });
    expect(byPhone.data).toHaveLength(1);

    const foreign = await repo.listCursor(TENANT_B, {
      limit: 10,
      sortBy: 'fullName',
      sortDir: 'asc',
    });
    expect(foreign.data.map((r) => r.fullName)).toEqual(['Foreign Person']);
  });

  it('filters by occupancy status', async () => {
    const placed = makeResident('Placed', '+962790000001');
    placed.occupy(APARTMENT, clock.now(), ACTOR, clock);
    await repo.save(placed);
    await repo.save(makeResident('Unplaced', '+962790000002'));

    const active = await repo.listCursor(TENANT_A, {
      limit: 10,
      sortBy: 'fullName',
      sortDir: 'asc',
      status: 'active',
    });
    expect(active.data.map((r) => r.fullName)).toEqual(['Placed']);

    const inactive = await repo.listCursor(TENANT_A, {
      limit: 10,
      sortBy: 'fullName',
      sortDir: 'asc',
      status: 'inactive',
    });
    expect(inactive.data.map((r) => r.fullName)).toEqual(['Unplaced']);
  });
});

describe('Lease repository — invariant helpers', () => {
  let repo: InMemoryLeaseContractRepository;
  beforeEach(() => {
    repo = new InMemoryLeaseContractRepository();
  });

  it('findActiveByApartment / findActiveByResident see only ACTIVE leases', async () => {
    const residentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const lease = makeLease('LC-1', '2026-01-01', '2027-01-01', { residentId });
    await repo.save(lease);

    expect((await repo.findActiveByApartment(TENANT_A, APARTMENT))?.id).toBe(lease.id);
    expect((await repo.findActiveByResident(TENANT_A, residentId))?.id).toBe(lease.id);
    expect(await repo.findActiveByApartment(TENANT_B, APARTMENT)).toBeNull();

    const loaded = (await repo.findById(TENANT_A, lease.id))!;
    loaded.terminate('Done with it', ACTOR, clock);
    await repo.save(loaded);
    expect(await repo.findActiveByApartment(TENANT_A, APARTMENT)).toBeNull();
    expect(await repo.findActiveByResident(TENANT_A, residentId)).toBeNull();
  });

  it('existsOverlapping detects Draft/Active overlaps and ignores history', async () => {
    await repo.save(makeLease('LC-ACTIVE', '2026-01-01', '2026-07-01'));
    const draft = makeLease('LC-DRAFT', '2026-09-01', '2027-01-01', { activate: false });
    await repo.save(draft);
    const terminated = makeLease('LC-DEAD', '2027-02-01', '2027-08-01');
    terminated.terminate('History', ACTOR, clock);
    await repo.save(terminated);

    // overlaps the active lease
    expect(
      await repo.existsOverlapping(
        TENANT_A,
        APARTMENT,
        new Date('2026-06-01'),
        new Date('2026-08-01'),
      ),
    ).toBe(true);
    // overlaps the draft lease
    expect(
      await repo.existsOverlapping(
        TENANT_A,
        APARTMENT,
        new Date('2026-08-15'),
        new Date('2026-10-01'),
      ),
    ).toBe(true);
    // only overlaps the terminated lease → free
    expect(
      await repo.existsOverlapping(
        TENANT_A,
        APARTMENT,
        new Date('2027-03-01'),
        new Date('2027-06-01'),
      ),
    ).toBe(false);
    // gap between active and draft → free
    expect(
      await repo.existsOverlapping(
        TENANT_A,
        APARTMENT,
        new Date('2026-07-01'),
        new Date('2026-09-01'),
      ),
    ).toBe(false);
    // exclusion for extensions
    const active = await repo.findActiveByApartment(TENANT_A, APARTMENT);
    expect(
      await repo.existsOverlapping(
        TENANT_A,
        APARTMENT,
        new Date('2026-01-01'),
        new Date('2026-08-01'),
        active!.id,
      ),
    ).toBe(false);
    // other apartment unaffected
    expect(
      await repo.existsOverlapping(
        TENANT_A,
        APARTMENT_2,
        new Date('2026-01-01'),
        new Date('2028-01-01'),
      ),
    ).toBe(false);
  });

  it('cursor list sorts by monthlyRent and filters by resident', async () => {
    const residentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const cheap = makeLease('LC-CHEAP', '2026-01-01', '2026-06-01', {
      residentId,
      activate: false,
    });
    const pricey = makeLease('LC-PRICEY', '2027-01-01', '2027-06-01', {
      apartmentId: APARTMENT_2,
      residentId: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
      activate: false,
    });
    await repo.save(cheap);
    await repo.save(pricey);

    const byResident = await repo.listCursor(TENANT_A, {
      limit: 10,
      sortBy: 'contractNumber',
      sortDir: 'asc',
      residentId,
    });
    expect(byResident.data.map((l) => l.contractNumber)).toEqual(['LC-CHEAP']);
  });
});

describe('Occupancy repository — history contract', () => {
  let repo: InMemoryOccupancyRepository;
  const RESIDENT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const LEASE = '99999999-9999-4999-8999-999999999999';

  beforeEach(() => {
    repo = new InMemoryOccupancyRepository();
  });

  const openStay = (moveIn: string, apartmentId = APARTMENT, residentId = RESIDENT): Occupancy =>
    Occupancy.open(
      TENANT_A,
      { apartmentId, residentId, leaseContractId: LEASE, moveInDate: new Date(moveIn) },
      ACTOR,
      clock,
    );

  it('finds active stays by apartment, resident and lease; closed stays drop out', async () => {
    const stay = openStay('2026-01-15');
    await repo.save(stay);

    expect((await repo.findActiveByApartment(TENANT_A, APARTMENT))?.id).toBe(stay.id);
    expect((await repo.findActiveByResident(TENANT_A, RESIDENT))?.id).toBe(stay.id);
    expect((await repo.findActiveByLease(TENANT_A, LEASE))?.id).toBe(stay.id);
    expect(await repo.findActiveByApartment(TENANT_B, APARTMENT)).toBeNull();

    stay.close(new Date('2026-03-01'), 'Left', ACTOR, clock);
    await repo.save(stay);
    expect(await repo.findActiveByApartment(TENANT_A, APARTMENT)).toBeNull();
    expect(await repo.findActiveByLease(TENANT_A, LEASE)).toBeNull();
    // …but history remains readable
    expect((await repo.findById(TENANT_A, stay.id))?.moveOutReason).toBe('Left');
  });

  it('lists history newest-first with active filter and cursor paging', async () => {
    const first = openStay('2026-01-01');
    first.close(new Date('2026-03-01'), null, ACTOR, clock);
    const second = openStay('2026-04-01', APARTMENT, 'ffffffff-ffff-4fff-8fff-fffffffffff1');
    await repo.save(first);
    await repo.save(second);

    const all = await repo.listCursor(TENANT_A, {
      limit: 1,
      sortBy: 'moveInDate',
      sortDir: 'desc',
      apartmentId: APARTMENT,
    });
    expect(all.data[0].id).toBe(second.id);
    expect(all.nextCursor).toBeTruthy();

    const nextPage = await repo.listCursor(TENANT_A, {
      limit: 1,
      sortBy: 'moveInDate',
      sortDir: 'desc',
      apartmentId: APARTMENT,
      cursor: all.nextCursor!,
    });
    expect(nextPage.data[0].id).toBe(first.id);
    expect(nextPage.nextCursor).toBeNull();

    const closedOnly = await repo.listCursor(TENANT_A, {
      limit: 10,
      sortBy: 'moveInDate',
      sortDir: 'desc',
      active: false,
    });
    expect(closedOnly.data.map((o) => o.id)).toEqual([first.id]);
  });
});

describe('Idempotency store contract', () => {
  let store: InMemoryIdempotencyStore;
  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  it('claims, completes and replays', async () => {
    expect((await store.begin('scope', 'key', 'hash')).kind).toBe('started');
    expect((await store.begin('scope', 'key', 'hash')).kind).toBe('in_progress');

    await store.complete('scope', 'key', 201, '{"ok":true}');
    const replay = await store.begin('scope', 'key', 'hash');
    expect(replay).toEqual({ kind: 'replay', responseStatus: 201, responseBody: '{"ok":true}' });
  });

  it('detects payload mismatches and scopes keys', async () => {
    await store.begin('scope', 'key', 'hash');
    expect((await store.begin('scope', 'key', 'OTHER')).kind).toBe('mismatch');
    // Same key in a different scope is a fresh claim
    expect((await store.begin('other-scope', 'key', 'hash')).kind).toBe('started');
  });

  it('release frees the key for a retry', async () => {
    await store.begin('scope', 'key', 'hash');
    await store.release('scope', 'key');
    expect((await store.begin('scope', 'key', 'hash')).kind).toBe('started');
  });
});
