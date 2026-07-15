import { DomainError } from '@domain/common/DomainError';
import {
  ArchiveApartment,
  CreateApartment,
  GetApartment,
  ListApartments,
  UpdateApartment,
} from '@application/use-cases/property/ApartmentUseCases';
import {
  ArchiveBuilding,
  CreateBuilding,
  GetBuilding,
  ListBuildings,
  UpdateBuilding,
} from '@application/use-cases/property/BuildingUseCases';
import { AddFloor, ListFloors, UpdateFloor } from '@application/use-cases/property/FloorUseCases';
import {
  CreateOwner,
  GetOwner,
  ListOwners,
  UpdateOwner,
} from '@application/use-cases/property/OwnerUseCases';
import { TenantActor } from '@application/use-cases/property/context';
import { AppError } from '@shared/errors/AppError';
import { InMemoryAuditLogRepository } from './fakes';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from './fakes.property';
import { FakeClock } from './support/FakeClock';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const actorA: TenantActor = { tenantId: TENANT_A, userId: USER_A };
const actorB: TenantActor = { tenantId: TENANT_B, userId: USER_B };

const buildingInput = {
  name: 'Amman Heights',
  address: '12 Rainbow Street, Amman',
  city: 'Amman',
  totalFloors: 6,
};

interface World {
  clock: FakeClock;
  buildings: InMemoryBuildingRepository;
  apartments: InMemoryApartmentRepository;
  owners: InMemoryOwnerRepository;
  audit: InMemoryAuditLogRepository;
  createBuilding: CreateBuilding;
  updateBuilding: UpdateBuilding;
  archiveBuilding: ArchiveBuilding;
  getBuilding: GetBuilding;
  listBuildings: ListBuildings;
  addFloor: AddFloor;
  updateFloor: UpdateFloor;
  listFloors: ListFloors;
  createApartment: CreateApartment;
  updateApartment: UpdateApartment;
  archiveApartment: ArchiveApartment;
  getApartment: GetApartment;
  listApartments: ListApartments;
  createOwner: CreateOwner;
  updateOwner: UpdateOwner;
  getOwner: GetOwner;
  listOwners: ListOwners;
}

const buildWorld = (): World => {
  const clock = new FakeClock();
  const buildings = new InMemoryBuildingRepository();
  const apartments = new InMemoryApartmentRepository();
  const owners = new InMemoryOwnerRepository();
  const audit = new InMemoryAuditLogRepository();
  return {
    clock,
    buildings,
    apartments,
    owners,
    audit,
    createBuilding: new CreateBuilding(buildings, audit, clock),
    updateBuilding: new UpdateBuilding(buildings, audit, clock),
    archiveBuilding: new ArchiveBuilding(buildings, apartments, audit, clock),
    getBuilding: new GetBuilding(buildings),
    listBuildings: new ListBuildings(buildings),
    addFloor: new AddFloor(buildings, audit, clock),
    updateFloor: new UpdateFloor(buildings, audit, clock),
    listFloors: new ListFloors(buildings),
    createApartment: new CreateApartment(apartments, buildings, audit, clock),
    updateApartment: new UpdateApartment(apartments, owners, audit, clock),
    archiveApartment: new ArchiveApartment(apartments, audit, clock),
    getApartment: new GetApartment(apartments),
    listApartments: new ListApartments(apartments),
    createOwner: new CreateOwner(owners, audit, clock),
    updateOwner: new UpdateOwner(owners, audit, clock),
    getOwner: new GetOwner(owners),
    listOwners: new ListOwners(owners),
  };
};

let world: World;
beforeEach(() => {
  world = buildWorld();
});

/** Creates a building with one floor; returns their ids. */
const seedBuildingWithFloor = async (
  actor = actorA,
): Promise<{ buildingId: string; floorId: string }> => {
  const building = await world.createBuilding.execute(actor, buildingInput);
  const floor = await world.addFloor.execute(actor, building.id, { floorNumber: 1 });
  return { buildingId: building.id, floorId: floor.id };
};

describe('Building use-cases', () => {
  it('creates a building stamped by the injected clock', async () => {
    const dto = await world.createBuilding.execute(actorA, buildingInput);
    expect(dto.name).toBe('Amman Heights');
    expect(dto.tenantId).toBe(TENANT_A);
    expect(dto.status).toBe('Active');
    expect(dto.floors).toEqual([]);
    expect(dto.createdAt).toBe(world.clock.now().toISOString());
    expect(world.audit.actions()).toContain('BUILDING_CREATED');
  });

  it('rejects a duplicate name within the same tenant (409)', async () => {
    await world.createBuilding.execute(actorA, buildingInput);
    await expect(world.createBuilding.execute(actorA, buildingInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'BUILDING_NAME_TAKEN',
    });
  });

  it('allows the same name in a different tenant (isolation)', async () => {
    await world.createBuilding.execute(actorA, buildingInput);
    await expect(world.createBuilding.execute(actorB, buildingInput)).resolves.toMatchObject({
      name: 'Amman Heights',
      tenantId: TENANT_B,
    });
  });

  it('updates details and blocks renaming onto an existing name', async () => {
    const first = await world.createBuilding.execute(actorA, buildingInput);
    await world.createBuilding.execute(actorA, { ...buildingInput, name: 'Petra Tower' });

    const updated = await world.updateBuilding.execute(actorA, first.id, { city: 'Irbid' });
    expect(updated.city).toBe('Irbid');

    await expect(
      world.updateBuilding.execute(actorA, first.id, { name: 'Petra Tower' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'BUILDING_NAME_TAKEN' });
  });

  it('is invisible to other tenants (get/update/archive → 404)', async () => {
    const dto = await world.createBuilding.execute(actorA, buildingInput);
    await expect(world.getBuilding.execute(actorB, dto.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      world.updateBuilding.execute(actorB, dto.id, { city: 'Aqaba' }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(world.archiveBuilding.execute(actorB, dto.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('cannot archive a building that still contains apartments', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    await world.createApartment.execute(actorA, { buildingId, floorId, unitNumber: '101' });

    await expect(world.archiveBuilding.execute(actorA, buildingId)).rejects.toMatchObject({
      statusCode: 409,
      code: 'BUILDING_HAS_APARTMENTS',
    });
  });

  it('archives once its apartments are archived, then disappears from lists', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const apartment = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
    });
    await world.archiveApartment.execute(actorA, apartment.id);
    await world.archiveBuilding.execute(actorA, buildingId);

    await expect(world.getBuilding.execute(actorA, buildingId)).rejects.toMatchObject({
      statusCode: 404,
    });
    const list = await world.listBuildings.execute(actorA, { page: 1, pageSize: 10 });
    expect(list.pagination.totalCount).toBe(0);
    expect(world.audit.actions()).toContain('BUILDING_ARCHIVED');
  });

  it('paginates the tenant building list', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await world.createBuilding.execute(actorA, { ...buildingInput, name: `Building ${i}` });
    }
    await world.createBuilding.execute(actorB, { ...buildingInput, name: 'Other tenant' });

    const page = await world.listBuildings.execute(actorA, { page: 2, pageSize: 2 });
    expect(page.pagination).toEqual({ page: 2, pageSize: 2, totalCount: 5, totalPages: 3 });
    expect(page.data).toHaveLength(2);
    expect(page.data.every((b) => b.tenantId === TENANT_A)).toBe(true);
  });
});

describe('Floor use-cases', () => {
  it('adds floors and lists them ordered by number', async () => {
    const building = await world.createBuilding.execute(actorA, buildingInput);
    await world.addFloor.execute(actorA, building.id, { floorNumber: 2, name: 'Second' });
    await world.addFloor.execute(actorA, building.id, { floorNumber: 0, name: 'Ground' });

    const floors = await world.listFloors.execute(actorA, building.id);
    expect(floors.map((f) => f.floorNumber)).toEqual([0, 2]);
  });

  it('rejects duplicate floor numbers inside the same building (409)', async () => {
    const building = await world.createBuilding.execute(actorA, buildingInput);
    await world.addFloor.execute(actorA, building.id, { floorNumber: 1 });
    await expect(
      world.addFloor.execute(actorA, building.id, { floorNumber: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'FLOOR_NUMBER_TAKEN' });
  });

  it('allows the same floor number in a different building', async () => {
    const first = await world.createBuilding.execute(actorA, buildingInput);
    const second = await world.createBuilding.execute(actorA, {
      ...buildingInput,
      name: 'Petra Tower',
    });
    await world.addFloor.execute(actorA, first.id, { floorNumber: 1 });
    await expect(
      world.addFloor.execute(actorA, second.id, { floorNumber: 1 }),
    ).resolves.toMatchObject({ floorNumber: 1 });
  });

  it('renames a floor', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const renamed = await world.updateFloor.execute(actorA, buildingId, floorId, {
      name: 'Penthouse',
    });
    expect(renamed.name).toBe('Penthouse');
  });

  it('404s for floors of another tenant', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    await expect(
      world.updateFloor.execute(actorB, buildingId, floorId, { name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Apartment use-cases', () => {
  it('creates an apartment on an existing floor', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const dto = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
      bedrooms: 2,
      baseRentAmount: 450,
    });
    expect(dto.status).toBe('Available');
    expect(dto.currency).toBe('JOD');
    expect(dto.createdAt).toBe(world.clock.now().toISOString());
  });

  it('rejects unknown buildings and floors (404)', async () => {
    const { buildingId } = await seedBuildingWithFloor();
    await expect(
      world.createApartment.execute(actorA, {
        buildingId: TENANT_B, // valid guid, not a building
        floorId: TENANT_B,
        unitNumber: '101',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'BUILDING_NOT_FOUND' });

    await expect(
      world.createApartment.execute(actorA, {
        buildingId,
        floorId: TENANT_B, // floor of a different building
        unitNumber: '101',
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'FLOOR_NOT_FOUND' });
  });

  it('enforces unit-number uniqueness inside a building (409)', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    await world.createApartment.execute(actorA, { buildingId, floorId, unitNumber: '101' });
    await expect(
      world.createApartment.execute(actorA, { buildingId, floorId, unitNumber: '101' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'UNIT_NUMBER_TAKEN' });
  });

  it('frees the unit number after archiving', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const first = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
    });
    await world.archiveApartment.execute(actorA, first.id);
    await expect(
      world.createApartment.execute(actorA, { buildingId, floorId, unitNumber: '101' }),
    ).resolves.toMatchObject({ unitNumber: '101' });
  });

  it('updates details, assigns an owner and transitions status', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const apartment = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
    });
    const owner = await world.createOwner.execute(actorA, { fullName: 'Layla Haddad' });

    const updated = await world.updateApartment.execute(actorA, apartment.id, {
      bedrooms: 3,
      ownerId: owner.id,
      status: 'OwnerOccupied',
    });
    expect(updated.bedrooms).toBe(3);
    expect(updated.ownerId).toBe(owner.id);
    expect(updated.status).toBe('OwnerOccupied');
  });

  it('rejects owners from another tenant (404)', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const apartment = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
    });
    const foreignOwner = await world.createOwner.execute(actorB, { fullName: 'Foreign Owner' });

    await expect(
      world.updateApartment.execute(actorA, apartment.id, { ownerId: foreignOwner.id }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'OWNER_NOT_FOUND' });
  });

  it('rejects illegal status transitions through the domain state machine', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const apartment = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
    });
    await world.updateApartment.execute(actorA, apartment.id, { status: 'Leased' });

    // Leased → Reserved is not a legal transition
    await expect(
      world.updateApartment.execute(actorA, apartment.id, { status: 'Reserved' }),
    ).rejects.toThrow(DomainError);
  });

  it('filters the list by building and isolates tenants', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const other = await seedBuildingWithFloor(actorB);
    await world.createApartment.execute(actorA, { buildingId, floorId, unitNumber: '101' });
    await world.createApartment.execute(actorA, { buildingId, floorId, unitNumber: '102' });
    await world.createApartment.execute(actorB, {
      buildingId: other.buildingId,
      floorId: other.floorId,
      unitNumber: '999',
    });

    const byBuilding = await world.listApartments.execute(
      actorA,
      { page: 1, pageSize: 10 },
      buildingId,
    );
    expect(byBuilding.pagination.totalCount).toBe(2);

    const allForTenantA = await world.listApartments.execute(actorA, { page: 1, pageSize: 10 });
    expect(allForTenantA.data.map((a) => a.unitNumber).sort()).toEqual(['101', '102']);
  });

  it('is invisible to other tenants (get → 404)', async () => {
    const { buildingId, floorId } = await seedBuildingWithFloor();
    const apartment = await world.createApartment.execute(actorA, {
      buildingId,
      floorId,
      unitNumber: '101',
    });
    await expect(world.getApartment.execute(actorB, apartment.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('Owner use-cases', () => {
  it('creates and reads an owner', async () => {
    const dto = await world.createOwner.execute(actorA, {
      fullName: 'Layla Haddad',
      email: 'layla@example.com',
    });
    await expect(world.getOwner.execute(actorA, dto.id)).resolves.toMatchObject({
      fullName: 'Layla Haddad',
      ownerType: 'Individual',
    });
  });

  it('requires a company name for company owners (422 domain invariant)', async () => {
    await expect(
      world.createOwner.execute(actorA, { ownerType: 'Company', fullName: 'ACME Holding' }),
    ).rejects.toThrow(DomainError);
  });

  it('updates identity and contact fields', async () => {
    const dto = await world.createOwner.execute(actorA, { fullName: 'Layla Haddad' });
    const updated = await world.updateOwner.execute(actorA, dto.id, {
      fullName: 'Layla H. Haddad',
      phoneNumber: '+962790001122',
      address: 'Abdoun, Amman',
    });
    expect(updated.fullName).toBe('Layla H. Haddad');
    expect(updated.phoneNumber).toBe('+962790001122');
    expect(updated.address).toBe('Abdoun, Amman');
  });

  it('is tenant-isolated (get/update from another tenant → 404)', async () => {
    const dto = await world.createOwner.execute(actorA, { fullName: 'Layla Haddad' });
    await expect(world.getOwner.execute(actorB, dto.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      world.updateOwner.execute(actorB, dto.id, { fullName: 'Hijacked' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists owners per tenant with paging', async () => {
    await world.createOwner.execute(actorA, { fullName: 'Aisha' });
    await world.createOwner.execute(actorA, { fullName: 'Bilal' });
    await world.createOwner.execute(actorB, { fullName: 'Foreign' });

    const page = await world.listOwners.execute(actorA, { page: 1, pageSize: 10 });
    expect(page.pagination.totalCount).toBe(2);
    expect(page.data.map((o) => o.fullName)).toEqual(['Aisha', 'Bilal']);
  });

  it('updates never leak across tenants even with a stolen id (defense in depth)', async () => {
    const dto = await world.createOwner.execute(actorA, { fullName: 'Layla Haddad' });
    await expect(world.updateOwner.execute(actorB, dto.id, { fullName: 'X' })).rejects.toThrow(
      AppError,
    );
    const untouched = await world.getOwner.execute(actorA, dto.id);
    expect(untouched.fullName).toBe('Layla Haddad');
  });
});
