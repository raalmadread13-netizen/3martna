import { Apartment } from '@domain/business/Apartment';
import { Building } from '@domain/business/Building';
import { Owner } from '@domain/business/Owner';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from './fakes.property';
import { FakeClock } from './support/FakeClock';

/*
 * Repository contract tests.
 *
 * These pin down the behavioral contract every ITenantRepository
 * implementation must satisfy: tenant isolation on every method,
 * soft-deleted rows excluded from reads, paging math, uniqueness helpers
 * and aggregate rehydration. They run against the in-memory
 * implementations (used by the API tests); the SQL implementations
 * mirror the same semantics with parameterized queries against
 * dbo.Buildings/Floors/Apartments/Owners.
 */

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const clock = new FakeClock();

const makeBuilding = (tenantId: string, name: string): Building =>
  Building.create(
    tenantId,
    { name, address: '12 Rainbow Street, Amman', city: 'Amman', totalFloors: 4 },
    ACTOR,
    clock,
  );

describe('Building repository contract', () => {
  let repo: InMemoryBuildingRepository;
  beforeEach(() => {
    repo = new InMemoryBuildingRepository();
  });

  it('round-trips an aggregate through save/findById', async () => {
    const building = makeBuilding(TENANT_A, 'Amman Heights');
    await repo.save(building);

    const loaded = await repo.findById(TENANT_A, building.id);
    expect(loaded?.toProps()).toMatchObject({
      id: building.id,
      name: 'Amman Heights',
      tenantId: TENANT_A,
    });
  });

  it('never returns rows of another tenant', async () => {
    const building = makeBuilding(TENANT_A, 'Amman Heights');
    await repo.save(building);

    expect(await repo.findById(TENANT_B, building.id)).toBeNull();
    expect(await repo.findByIdWithFloors(TENANT_B, building.id)).toBeNull();
    expect(await repo.existsByName(TENANT_B, 'Amman Heights')).toBe(false);
    expect((await repo.listByTenant(TENANT_B, { page: 1, pageSize: 10 })).data).toHaveLength(0);
  });

  it('excludes soft-deleted rows from every read', async () => {
    const building = makeBuilding(TENANT_A, 'Amman Heights');
    await repo.save(building);
    building.softDelete(ACTOR, clock.now());
    await repo.remove(building);

    expect(await repo.findById(TENANT_A, building.id)).toBeNull();
    expect(await repo.existsByName(TENANT_A, 'Amman Heights')).toBe(false);
    expect(
      (await repo.listByTenant(TENANT_A, { page: 1, pageSize: 10 })).pagination.totalCount,
    ).toBe(0);
  });

  it('persists floors with the aggregate and rehydrates them', async () => {
    const building = makeBuilding(TENANT_A, 'Amman Heights');
    building.addFloor(0, 'Ground', ACTOR, clock);
    building.addFloor(1, null, ACTOR, clock);
    await repo.save(building);

    const loaded = await repo.findByIdWithFloors(TENANT_A, building.id);
    expect(loaded?.floors).toHaveLength(2);
    expect(loaded?.floors.map((f) => f.floorNumber).sort()).toEqual([0, 1]);

    // findById (without floors) still returns the root
    const bare = await repo.findById(TENANT_A, building.id);
    expect(bare?.floors).toHaveLength(0);
  });

  it('pages with correct totals and ordering', async () => {
    for (const name of ['Charlie', 'Alpha', 'Bravo']) {
      await repo.save(makeBuilding(TENANT_A, name));
    }
    const page1 = await repo.listByTenant(TENANT_A, { page: 1, pageSize: 2 });
    expect(page1.pagination).toEqual({ page: 1, pageSize: 2, totalCount: 3, totalPages: 2 });
    expect(page1.data.map((b) => b.name)).toEqual(['Alpha', 'Bravo']);

    const page2 = await repo.listByTenant(TENANT_A, { page: 2, pageSize: 2 });
    expect(page2.data.map((b) => b.name)).toEqual(['Charlie']);
  });
});

describe('Apartment repository contract', () => {
  let repo: InMemoryApartmentRepository;
  let building: Building;
  let floorId: string;

  beforeEach(async () => {
    repo = new InMemoryApartmentRepository();
    building = makeBuilding(TENANT_A, 'Amman Heights');
    floorId = building.addFloor(1, null, ACTOR, clock).id;
  });

  const makeApartment = (unitNumber: string, tenantId = TENANT_A): Apartment =>
    Apartment.create(tenantId, { buildingId: building.id, floorId, unitNumber }, ACTOR, clock);

  it('enforces reads by tenant and soft-delete', async () => {
    const apartment = makeApartment('101');
    await repo.save(apartment);

    expect(await repo.findById(TENANT_B, apartment.id)).toBeNull();

    apartment.softDelete(ACTOR, clock.now());
    await repo.remove(apartment);
    expect(await repo.findById(TENANT_A, apartment.id)).toBeNull();
  });

  it('existsByUnitNumber is tenant- and soft-delete-aware', async () => {
    const apartment = makeApartment('101');
    await repo.save(apartment);

    expect(await repo.existsByUnitNumber(TENANT_A, building.id, '101')).toBe(true);
    expect(await repo.existsByUnitNumber(TENANT_B, building.id, '101')).toBe(false);

    apartment.softDelete(ACTOR, clock.now());
    await repo.remove(apartment);
    expect(await repo.existsByUnitNumber(TENANT_A, building.id, '101')).toBe(false);
  });

  it('counts live apartments grouped by status', async () => {
    const first = makeApartment('101');
    const second = makeApartment('102');
    second.markLeased(ACTOR, clock);
    const archived = makeApartment('103');
    archived.softDelete(ACTOR, clock.now());
    await repo.save(first);
    await repo.save(second);
    await repo.save(archived);

    expect(await repo.countByStatus(TENANT_A, building.id)).toEqual({
      Available: 1,
      Leased: 1,
    });
  });

  it('filters listByBuilding and pages the results', async () => {
    await repo.save(makeApartment('101'));
    await repo.save(makeApartment('102'));

    const page = await repo.listByBuilding(TENANT_A, building.id, { page: 1, pageSize: 1 });
    expect(page.pagination).toEqual({ page: 1, pageSize: 1, totalCount: 2, totalPages: 2 });
    expect(page.data[0].unitNumber).toBe('101');
  });
});

describe('Owner repository contract', () => {
  let repo: InMemoryOwnerRepository;
  beforeEach(() => {
    repo = new InMemoryOwnerRepository();
  });

  const makeOwner = (fullName: string, tenantId = TENANT_A): Owner =>
    Owner.create(tenantId, { fullName }, ACTOR, clock);

  it('round-trips, isolates tenants and hides soft-deleted rows', async () => {
    const owner = makeOwner('Layla Haddad');
    await repo.save(owner);

    expect((await repo.findById(TENANT_A, owner.id))?.fullName).toBe('Layla Haddad');
    expect(await repo.findById(TENANT_B, owner.id)).toBeNull();

    owner.softDelete(ACTOR, clock.now());
    await repo.remove(owner);
    expect(await repo.findById(TENANT_A, owner.id)).toBeNull();
  });

  it('finds owners by linked user id within the tenant', async () => {
    const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const owner = makeOwner('Layla Haddad');
    owner.linkUser(userId, ACTOR, clock);
    await repo.save(owner);

    expect((await repo.findByUserId(TENANT_A, userId))?.id).toBe(owner.id);
    expect(await repo.findByUserId(TENANT_B, userId)).toBeNull();
  });

  it('lists per tenant ordered by name with paging', async () => {
    await repo.save(makeOwner('Bilal'));
    await repo.save(makeOwner('Aisha'));
    await repo.save(makeOwner('Foreign', TENANT_B));

    const page = await repo.listByTenant(TENANT_A, { page: 1, pageSize: 10 });
    expect(page.pagination.totalCount).toBe(2);
    expect(page.data.map((o) => o.fullName)).toEqual(['Aisha', 'Bilal']);
  });
});
