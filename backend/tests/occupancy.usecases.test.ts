import { Apartment } from '@domain/business/Apartment';
import { Building } from '@domain/business/Building';
import { LeaseContract } from '@domain/business/LeaseContract';
import { Owner } from '@domain/business/Owner';
import { DomainError } from '@domain/common/DomainError';
import {
  CreateLease,
  GetLease,
  ListLeases,
  TerminateLease,
  UpdateLease,
} from '@application/use-cases/occupancy/LeaseUseCases';
import {
  GetOccupancy,
  ListOccupancyHistory,
  MoveIn,
  MoveOut,
} from '@application/use-cases/occupancy/OccupancyUseCases';
import {
  GetResident,
  ListResidents,
  RegisterResident,
  UpdateResident,
} from '@application/use-cases/occupancy/ResidentUseCases';
import { TenantActor } from '@application/use-cases/property/context';
import { InMemoryAuditLogRepository } from './fakes';
import {
  InMemoryLeaseContractRepository,
  InMemoryOccupancyRepository,
  InMemoryResidentRepository,
} from './fakes.occupancy';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from './fakes.property';
import { FakeClock } from './support/FakeClock';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const actorA: TenantActor = { tenantId: TENANT_A, userId: USER_A };
const actorB: TenantActor = { tenantId: TENANT_B, userId: USER_A };

interface World {
  clock: FakeClock;
  residents: InMemoryResidentRepository;
  leases: InMemoryLeaseContractRepository;
  occupancies: InMemoryOccupancyRepository;
  apartments: InMemoryApartmentRepository;
  buildings: InMemoryBuildingRepository;
  owners: InMemoryOwnerRepository;
  audit: InMemoryAuditLogRepository;
  registerResident: RegisterResident;
  updateResident: UpdateResident;
  getResident: GetResident;
  listResidents: ListResidents;
  createLease: CreateLease;
  updateLease: UpdateLease;
  getLease: GetLease;
  listLeases: ListLeases;
  terminateLease: TerminateLease;
  moveIn: MoveIn;
  moveOut: MoveOut;
  getOccupancy: GetOccupancy;
  listOccupancyHistory: ListOccupancyHistory;
}

const buildWorld = (): World => {
  const clock = new FakeClock(); // 2026-01-01T00:00:00Z
  const residents = new InMemoryResidentRepository();
  const leases = new InMemoryLeaseContractRepository();
  const occupancies = new InMemoryOccupancyRepository();
  const apartments = new InMemoryApartmentRepository();
  const buildings = new InMemoryBuildingRepository();
  const owners = new InMemoryOwnerRepository();
  const audit = new InMemoryAuditLogRepository();
  return {
    clock,
    residents,
    leases,
    occupancies,
    apartments,
    buildings,
    owners,
    audit,
    registerResident: new RegisterResident(residents, audit, clock),
    updateResident: new UpdateResident(residents, audit, clock),
    getResident: new GetResident(residents),
    listResidents: new ListResidents(residents),
    createLease: new CreateLease(leases, apartments, residents, audit, clock),
    updateLease: new UpdateLease(leases, audit, clock),
    getLease: new GetLease(leases),
    listLeases: new ListLeases(leases),
    terminateLease: new TerminateLease(leases, occupancies, residents, apartments, audit, clock),
    moveIn: new MoveIn(occupancies, leases, residents, apartments, audit, clock),
    moveOut: new MoveOut(occupancies, residents, apartments, audit, clock),
    getOccupancy: new GetOccupancy(occupancies),
    listOccupancyHistory: new ListOccupancyHistory(occupancies),
  };
};

let world: World;
beforeEach(() => {
  world = buildWorld();
});

/** Seeds building + floor + owned apartment; returns the apartment id. */
const seedApartment = async (unitNumber = '101', tenantId = TENANT_A): Promise<string> => {
  const building = Building.create(
    tenantId,
    {
      name: `Bldg-${unitNumber}-${Math.random()}`,
      address: '12 Rainbow Street, Amman',
      city: 'Amman',
      totalFloors: 4,
    },
    USER_A,
    world.clock,
  );
  const floor = building.addFloor(1, null, USER_A, world.clock);
  await world.buildings.save(building);
  const owner = Owner.create(tenantId, { fullName: 'Owner One' }, USER_A, world.clock);
  await world.owners.save(owner);
  const apartment = Apartment.create(
    tenantId,
    { buildingId: building.id, floorId: floor.id, unitNumber },
    USER_A,
    world.clock,
  );
  apartment.assignOwner(owner.id, USER_A, world.clock);
  await world.apartments.save(apartment);
  return apartment.id;
};

const registerResident = async (
  fullName = 'Sara Khalil',
  phone = '+962790000001',
): Promise<string> => {
  const dto = await world.registerResident.execute(actorA, { fullName, phoneNumber: phone });
  return dto.id;
};

const leaseInput = (
  apartmentId: string,
  residentId: string,
  overrides: Record<string, unknown> = {},
): {
  apartmentId: string;
  residentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
} => ({
  apartmentId,
  residentId,
  startDate: '2026-01-01',
  endDate: '2027-01-01',
  monthlyRent: 450,
  ...overrides,
});

/** Seeds an ACTIVE lease directly (bypasses CreateLease guards). */
const seedActiveLease = async (
  apartmentId: string,
  residentId: string,
  start: string,
  end: string,
  ownerId?: string,
): Promise<string> => {
  const owner = ownerId ?? Owner.create(TENANT_A, { fullName: 'Lessor' }, USER_A, world.clock).id;
  const lease = LeaseContract.draft(
    TENANT_A,
    {
      contractNumber: `SEED-${Math.floor(Math.random() * 1e9)}`,
      apartmentId,
      ownerId: owner,
      residentId,
      startDate: new Date(start),
      endDate: new Date(end),
      monthlyRent: 300,
    },
    USER_A,
    world.clock,
  );
  lease.activate(USER_A, world.clock);
  await world.leases.save(lease);
  return lease.id;
};

describe('Resident use-cases', () => {
  it('registers a resident without an apartment', async () => {
    const dto = await world.registerResident.execute(actorA, {
      fullName: 'Sara Khalil',
      phoneNumber: '+962790000001',
      email: 'sara@example.com',
    });
    expect(dto.apartmentId).toBeNull();
    expect(dto.moveInDate).toBeNull();
    expect(dto.isActive).toBe(false);
    expect(dto.residencyType).toBe('LeaseTenant');
    expect(world.audit.actions()).toContain('RESIDENT_REGISTERED');
  });

  it('updates resident details', async () => {
    const id = await registerResident();
    const dto = await world.updateResident.execute(actorA, id, {
      fullName: 'Sara K. Khalil',
      emergencyContactName: 'Omar',
      emergencyContactPhone: '+962790000009',
    });
    expect(dto.fullName).toBe('Sara K. Khalil');
    expect(dto.emergencyContactName).toBe('Omar');
  });

  it('is tenant-isolated (get/update → 404)', async () => {
    const id = await registerResident();
    await expect(world.getResident.execute(actorB, id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      world.updateResident.execute(actorB, id, { fullName: 'Hijack' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists with search, filtering and cursor pagination (no dupes, no misses)', async () => {
    for (const [name, phone] of [
      ['Aisha Zaid', '+962790000001'],
      ['Bilal Odeh', '+962790000002'],
      ['Carmen Haddad', '+962790000003'],
      ['Dina Nassar', '+962790000004'],
      ['Elias Qasem', '+962790000005'],
    ] as const) {
      await world.registerResident.execute(actorA, { fullName: name, phoneNumber: phone });
    }

    // search
    const found = await world.listResidents.execute(actorA, {
      limit: 10,
      sortBy: 'fullName',
      sortDir: 'asc',
      search: 'haddad',
    });
    expect(found.data.map((r) => r.fullName)).toEqual(['Carmen Haddad']);

    // cursor walk: 2 + 2 + 1
    const seen: string[] = [];
    let cursor: string | undefined;
    for (const expected of [2, 2, 1]) {
      const page = await world.listResidents.execute(actorA, {
        limit: 2,
        sortBy: 'fullName',
        sortDir: 'asc',
        cursor,
      });
      expect(page.data).toHaveLength(expected);
      seen.push(...page.data.map((r) => r.fullName));
      cursor = page.nextCursor ?? undefined;
    }
    expect(cursor).toBeUndefined();
    expect(seen).toEqual([
      'Aisha Zaid',
      'Bilal Odeh',
      'Carmen Haddad',
      'Dina Nassar',
      'Elias Qasem',
    ]);
  });
});

describe('Lease use-cases — business rules', () => {
  it('creates an active lease with a generated contract number and the apartment owner as lessor', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();

    const dto = await world.createLease.execute(actorA, leaseInput(apartmentId, residentId));
    expect(dto.status).toBe('Active');
    expect(dto.contractNumber).toMatch(/^LC-2026-\d{6}$/);
    const apartment = await world.apartments.findById(TENANT_A, apartmentId);
    expect(dto.ownerId).toBe(apartment!.ownerId);
    expect(world.audit.actions()).toContain('LEASE_CREATED');
  });

  it('RULE: one apartment may have only ONE active lease', async () => {
    const apartmentId = await seedApartment();
    const residentA = await registerResident('Sara Khalil', '+962790000001');
    const residentB = await registerResident('Bilal Odeh', '+962790000002');

    await world.createLease.execute(actorA, leaseInput(apartmentId, residentA));
    await expect(
      world.createLease.execute(
        actorA,
        leaseInput(apartmentId, residentB, { startDate: '2027-02-01', endDate: '2028-02-01' }),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'APARTMENT_HAS_ACTIVE_LEASE' });
  });

  it('RULE: a resident cannot have multiple active leases', async () => {
    const firstApartment = await seedApartment('101');
    const secondApartment = await seedApartment('202');
    const residentId = await registerResident();

    await world.createLease.execute(actorA, leaseInput(firstApartment, residentId));
    await expect(
      world.createLease.execute(actorA, leaseInput(secondApartment, residentId)),
    ).rejects.toMatchObject({ statusCode: 409, code: 'RESIDENT_HAS_ACTIVE_LEASE' });
  });

  it('RULE: lease dates cannot overlap for the same apartment (draft overlaps too)', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();

    // A Draft lease occupies [2026-06-01, 2027-06-01) — not active, still blocks overlap
    const owner = Owner.create(TENANT_A, { fullName: 'Lessor' }, USER_A, world.clock);
    await world.owners.save(owner);
    const draft = LeaseContract.draft(
      TENANT_A,
      {
        contractNumber: 'DRAFT-001',
        apartmentId,
        ownerId: owner.id,
        residentId,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-06-01'),
        monthlyRent: 300,
      },
      USER_A,
      world.clock,
    );
    await world.leases.save(draft);

    const otherResident = await registerResident('Bilal Odeh', '+962790000002');
    await expect(
      world.createLease.execute(
        actorA,
        leaseInput(apartmentId, otherResident, { startDate: '2026-01-01', endDate: '2026-07-01' }),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'LEASE_DATES_OVERLAP' });

    // Non-overlapping window is fine
    await expect(
      world.createLease.execute(
        actorA,
        leaseInput(apartmentId, otherResident, { startDate: '2027-07-01', endDate: '2028-07-01' }),
      ),
    ).resolves.toMatchObject({ status: 'Active' });
  });

  it('rejects a taken contract number and an apartment without an owner', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    await world.createLease.execute(
      actorA,
      leaseInput(apartmentId, residentId, { contractNumber: 'LC-X-1' }),
    );

    const secondApartment = await seedApartment('202');
    const otherResident = await registerResident('Bilal Odeh', '+962790000002');
    await expect(
      world.createLease.execute(
        actorA,
        leaseInput(secondApartment, otherResident, { contractNumber: 'LC-X-1' }),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONTRACT_NUMBER_TAKEN' });

    // Apartment with no owner cannot be leased
    const building = Building.create(
      TENANT_A,
      { name: 'Ownerless', address: '1 Nowhere St, Amman', city: 'Amman', totalFloors: 1 },
      USER_A,
      world.clock,
    );
    const floor = building.addFloor(0, null, USER_A, world.clock);
    await world.buildings.save(building);
    const ownerless = Apartment.create(
      TENANT_A,
      { buildingId: building.id, floorId: floor.id, unitNumber: '901' },
      USER_A,
      world.clock,
    );
    await world.apartments.save(ownerless);
    await expect(
      world.createLease.execute(actorA, leaseInput(ownerless.id, otherResident)),
    ).rejects.toMatchObject({ statusCode: 409, code: 'APARTMENT_HAS_NO_OWNER' });
  });

  it('extends a lease and blocks extensions overlapping another lease', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    const lease = await world.createLease.execute(
      actorA,
      leaseInput(apartmentId, residentId, { endDate: '2026-06-01' }),
    );

    const extended = await world.updateLease.execute(actorA, lease.id, { endDate: '2026-09-01' });
    expect(extended.endDate.startsWith('2026-09-01')).toBe(true);

    // A draft lease starting 2026-10-01 blocks extending past it
    const owner = Owner.create(TENANT_A, { fullName: 'Lessor' }, USER_A, world.clock);
    await world.owners.save(owner);
    const draft = LeaseContract.draft(
      TENANT_A,
      {
        contractNumber: 'DRAFT-EXT',
        apartmentId,
        ownerId: owner.id,
        residentId,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2027-10-01'),
        monthlyRent: 300,
      },
      USER_A,
      world.clock,
    );
    await world.leases.save(draft);

    await expect(
      world.updateLease.execute(actorA, lease.id, { endDate: '2026-12-01' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'LEASE_DATES_OVERLAP' });
  });

  it('lists leases with status filter and cursor pagination', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    const lease = await world.createLease.execute(actorA, leaseInput(apartmentId, residentId));
    await world.terminateLease.execute(actorA, lease.id, { reason: 'Tenant request' });

    const terminated = await world.listLeases.execute(actorA, {
      limit: 10,
      sortBy: 'startDate',
      sortDir: 'desc',
      status: 'Terminated',
    });
    expect(terminated.data).toHaveLength(1);

    const active = await world.listLeases.execute(actorA, {
      limit: 10,
      sortBy: 'startDate',
      sortDir: 'desc',
      status: 'Active',
    });
    expect(active.data).toHaveLength(0);
  });
});

describe('Move-In / Move-Out workflow', () => {
  const setup = async (): Promise<{ apartmentId: string; residentId: string; leaseId: string }> => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    const lease = await world.createLease.execute(actorA, leaseInput(apartmentId, residentId));
    return { apartmentId, residentId, leaseId: lease.id };
  };

  it('WORKFLOW: register → lease → move in → occupancy active, resident placed, apartment Leased', async () => {
    const { apartmentId, residentId, leaseId } = await setup();

    const occupancy = await world.moveIn.execute(actorA, { leaseId });
    expect(occupancy.isActive).toBe(true);
    expect(occupancy.apartmentId).toBe(apartmentId);
    expect(occupancy.moveInDate.startsWith('2026-01-01')).toBe(true); // defaults to lease start

    const resident = await world.getResident.execute(actorA, residentId);
    expect(resident.isActive).toBe(true);
    expect(resident.apartmentId).toBe(apartmentId);

    const apartment = await world.apartments.findById(TENANT_A, apartmentId);
    expect(apartment!.status).toBe('Leased');
    expect(world.audit.actions()).toContain('MOVE_IN');
  });

  it('RULE: move-in requires an ACTIVE lease', async () => {
    const { leaseId } = await setup();
    await world.terminateLease.execute(actorA, leaseId, { reason: 'Cancelled plans' });

    await expect(world.moveIn.execute(actorA, { leaseId })).rejects.toMatchObject({
      statusCode: 409,
      code: 'MOVE_IN_REQUIRES_ACTIVE_LEASE',
    });
  });

  it('rejects move-in dates outside the lease period (422)', async () => {
    const { leaseId } = await setup();
    await expect(
      world.moveIn.execute(actorA, { leaseId, moveInDate: '2027-06-01' }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MOVE_IN_OUTSIDE_LEASE' });
  });

  it('RULE: one active occupancy per apartment and per resident', async () => {
    const { apartmentId, residentId, leaseId } = await setup();
    await world.moveIn.execute(actorA, { leaseId });

    // Another active lease on the SAME apartment (seeded around the guards)
    const otherResident = await registerResident('Bilal Odeh', '+962790000002');
    const sameApartmentLease = await seedActiveLease(
      apartmentId,
      otherResident,
      '2026-01-01',
      '2027-01-01',
    );
    await expect(
      world.moveIn.execute(actorA, { leaseId: sameApartmentLease }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'APARTMENT_ALREADY_OCCUPIED',
    });

    // The SAME resident with another active lease elsewhere
    const otherApartment = await seedApartment('303');
    const sameResidentLease = await seedActiveLease(
      otherApartment,
      residentId,
      '2026-01-01',
      '2027-01-01',
    );
    await expect(
      world.moveIn.execute(actorA, { leaseId: sameResidentLease }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'RESIDENT_ALREADY_MOVED_IN',
    });
  });

  it('WORKFLOW: move-out closes the stay, frees apartment and resident, keeps history', async () => {
    const { apartmentId, residentId, leaseId } = await setup();
    const occupancy = await world.moveIn.execute(actorA, { leaseId });

    world.clock.advance(90 * 24 * 3600 * 1000); // three months later
    const closed = await world.moveOut.execute(actorA, occupancy.id, {
      moveOutDate: '2026-04-01',
      reason: 'Relocation',
    });
    expect(closed.isActive).toBe(false);
    expect(closed.moveOutDate!.startsWith('2026-04-01')).toBe(true);
    expect(closed.moveOutReason).toBe('Relocation');

    const resident = await world.getResident.execute(actorA, residentId);
    expect(resident.isActive).toBe(false);
    const apartment = await world.apartments.findById(TENANT_A, apartmentId);
    expect(apartment!.status).toBe('Available');

    // History preserved — the closed stay is still readable and listable
    await expect(world.getOccupancy.execute(actorA, occupancy.id)).resolves.toMatchObject({
      id: occupancy.id,
      isActive: false,
    });
    const history = await world.listOccupancyHistory.execute(actorA, {
      limit: 10,
      sortBy: 'moveInDate',
      sortDir: 'desc',
      apartmentId,
    });
    expect(history.data).toHaveLength(1);
    expect(world.audit.actions()).toContain('MOVE_OUT');
  });

  it('rejects double move-out (409) and pre-move-in dates (422)', async () => {
    const { leaseId } = await setup();
    const occupancy = await world.moveIn.execute(actorA, { leaseId });

    await expect(
      world.moveOut.execute(actorA, occupancy.id, { moveOutDate: '2025-12-01' }),
    ).rejects.toThrow(DomainError); // OCCUPANCY_MOVEOUT_DATE → 422 at the API

    await world.moveOut.execute(actorA, occupancy.id, {});
    await expect(world.moveOut.execute(actorA, occupancy.id, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'OCCUPANCY_ALREADY_CLOSED',
    });
  });

  it('RULE: terminating a lease automatically ends its occupancy', async () => {
    const { apartmentId, residentId, leaseId } = await setup();
    const occupancy = await world.moveIn.execute(actorA, { leaseId });

    const lease = await world.terminateLease.execute(actorA, leaseId, {
      reason: 'Contract breach',
    });
    expect(lease.status).toBe('Terminated');

    const closed = await world.getOccupancy.execute(actorA, occupancy.id);
    expect(closed.isActive).toBe(false);
    expect(closed.moveOutReason).toContain('Lease terminated');

    const resident = await world.getResident.execute(actorA, residentId);
    expect(resident.isActive).toBe(false);
    const apartment = await world.apartments.findById(TENANT_A, apartmentId);
    expect(apartment!.status).toBe('Available');
  });

  it('WORKFLOW: full re-let cycle builds up per-apartment history', async () => {
    const { apartmentId, leaseId } = await setup();
    const first = await world.moveIn.execute(actorA, { leaseId });
    await world.moveOut.execute(actorA, first.id, { moveOutDate: '2026-03-01' });
    await world.terminateLease.execute(actorA, leaseId, { reason: 'Tenant moved out early' });

    // Re-let to a new resident
    const nextResident = await registerResident('Bilal Odeh', '+962790000002');
    const nextLease = await world.createLease.execute(
      actorA,
      leaseInput(apartmentId, nextResident, { startDate: '2027-02-01', endDate: '2028-02-01' }),
    );
    await world.moveIn.execute(actorA, { leaseId: nextLease.id, moveInDate: '2027-02-15' });

    const history = await world.listOccupancyHistory.execute(actorA, {
      limit: 10,
      sortBy: 'moveInDate',
      sortDir: 'desc',
      apartmentId,
    });
    expect(history.data).toHaveLength(2);
    expect(history.data[0].isActive).toBe(true); // newest stay first
    expect(history.data[1].isActive).toBe(false);

    const activeOnly = await world.listOccupancyHistory.execute(actorA, {
      limit: 10,
      sortBy: 'moveInDate',
      sortDir: 'desc',
      apartmentId,
      active: true,
    });
    expect(activeOnly.data).toHaveLength(1);
  });

  it('keeps every occupancy read tenant-isolated', async () => {
    const { leaseId } = await setup();
    const occupancy = await world.moveIn.execute(actorA, { leaseId });

    await expect(world.getOccupancy.execute(actorB, occupancy.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    const foreign = await world.listOccupancyHistory.execute(actorB, {
      limit: 10,
      sortBy: 'moveInDate',
      sortDir: 'desc',
    });
    expect(foreign.data).toHaveLength(0);
  });
});
