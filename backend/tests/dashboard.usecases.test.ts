import { Apartment } from '@domain/business/Apartment';
import { Building } from '@domain/business/Building';
import { LeaseContract } from '@domain/business/LeaseContract';
import { Occupancy } from '@domain/business/Occupancy';
import { Owner } from '@domain/business/Owner';
import { Resident } from '@domain/business/Resident';
import {
  GetBuildingSummaries,
  GetDashboardSummary,
  GetLeaseAlerts,
  GetRecentActivity,
} from '@application/use-cases/dashboard/DashboardUseCases';
import { TenantActor } from '@application/use-cases/property/context';
import { InMemoryDashboardRepository } from './fakes.dashboard';
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

const DAY_MS = 24 * 60 * 60 * 1000;

interface World {
  clock: FakeClock;
  buildings: InMemoryBuildingRepository;
  apartments: InMemoryApartmentRepository;
  owners: InMemoryOwnerRepository;
  residents: InMemoryResidentRepository;
  leases: InMemoryLeaseContractRepository;
  occupancies: InMemoryOccupancyRepository;
  getDashboardSummary: GetDashboardSummary;
  getBuildingSummaries: GetBuildingSummaries;
  getLeaseAlerts: GetLeaseAlerts;
  getRecentActivity: GetRecentActivity;
}

const buildWorld = (): World => {
  const clock = new FakeClock(); // 2026-01-01T00:00:00Z
  const buildings = new InMemoryBuildingRepository();
  const apartments = new InMemoryApartmentRepository();
  const owners = new InMemoryOwnerRepository();
  const residents = new InMemoryResidentRepository();
  const leases = new InMemoryLeaseContractRepository();
  const occupancies = new InMemoryOccupancyRepository();
  const dashboard = new InMemoryDashboardRepository(
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
  );
  return {
    clock,
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
    getDashboardSummary: new GetDashboardSummary(dashboard, clock),
    getBuildingSummaries: new GetBuildingSummaries(dashboard),
    getLeaseAlerts: new GetLeaseAlerts(leases, clock),
    getRecentActivity: new GetRecentActivity(dashboard),
  };
};

let world: World;
beforeEach(() => {
  world = buildWorld();
});

/* ----------------------------- seeding ------------------------- */

const seedBuilding = async (name: string, tenantId = TENANT_A): Promise<Building> => {
  const building = Building.create(
    tenantId,
    { name, address: `${name} Street 1, Amman`, city: 'Amman', totalFloors: 4 },
    USER_A,
    world.clock,
  );
  building.addFloor(1, null, USER_A, world.clock);
  await world.buildings.save(building);
  return building;
};

const seedApartment = async (building: Building, unitNumber: string): Promise<Apartment> => {
  const apartment = Apartment.create(
    building.tenantId,
    { buildingId: building.id, floorId: building.floors[0].id, unitNumber },
    USER_A,
    world.clock,
  );
  await world.apartments.save(apartment);
  return apartment;
};

/** Active lease ending `endsInDays` from the clock's now. */
const seedActiveLease = async (
  apartment: Apartment,
  residentId: string,
  endsInDays: number,
  contractNumber = `LC-${Math.floor(Math.random() * 1e9)}`,
): Promise<LeaseContract> => {
  const owner = Owner.create(TENANT_A, { fullName: 'Lessor' }, USER_A, world.clock);
  await world.owners.save(owner);
  const now = world.clock.now();
  const lease = LeaseContract.draft(
    TENANT_A,
    {
      contractNumber,
      apartmentId: apartment.id,
      ownerId: owner.id,
      residentId,
      startDate: new Date(now.getTime() - 30 * DAY_MS),
      endDate: new Date(now.getTime() + endsInDays * DAY_MS),
      monthlyRent: 400,
    },
    USER_A,
    world.clock,
  );
  lease.activate(USER_A, world.clock);
  await world.leases.save(lease);
  return lease;
};

const seedResident = async (fullName: string, tenantId = TENANT_A): Promise<Resident> => {
  const resident = Resident.register(
    tenantId,
    { fullName, phoneNumber: '+962790000001' },
    USER_A,
    world.clock,
  );
  await world.residents.save(resident);
  return resident;
};

const seedOccupancy = async (
  apartment: Apartment,
  residentId: string,
  leaseId: string,
): Promise<Occupancy> => {
  const occupancy = Occupancy.open(
    TENANT_A,
    {
      apartmentId: apartment.id,
      residentId,
      leaseContractId: leaseId,
      moveInDate: world.clock.now(),
    },
    USER_A,
    world.clock,
  );
  await world.occupancies.save(occupancy);
  return occupancy;
};

/* ------------------------------ tests -------------------------- */

describe('GetDashboardSummary — statistics', () => {
  it('returns zeros (and the maintenance placeholder) on an empty tenant', async () => {
    const summary = await world.getDashboardSummary.execute(actorA);
    expect(summary).toMatchObject({
      totalBuildings: 0,
      totalApartments: 0,
      occupiedApartments: 0,
      vacantApartments: 0,
      totalOwners: 0,
      totalResidents: 0,
      activeLeases: 0,
      expiringLeases: 0,
      openMaintenanceRequests: 0,
      occupancyRate: 0,
    });
    expect(summary.asOf).toBe(world.clock.now().toISOString());
  });

  it('computes occupied/vacant/occupancy-rate from active stays', async () => {
    const building = await seedBuilding('Amman Heights');
    const first = await seedApartment(building, '101');
    const second = await seedApartment(building, '102');
    await seedApartment(building, '103');

    const residentA = await seedResident('Sara');
    const residentB = await seedResident('Bilal');
    const leaseA = await seedActiveLease(first, residentA.id, 120);
    const leaseB = await seedActiveLease(second, residentB.id, 300);
    await seedOccupancy(first, residentA.id, leaseA.id);
    const closed = await seedOccupancy(second, residentB.id, leaseB.id);
    closed.close(world.clock.now(), 'left', USER_A, world.clock); // moved out again
    await world.occupancies.save(closed);

    const summary = await world.getDashboardSummary.execute(actorA);
    expect(summary.totalBuildings).toBe(1);
    expect(summary.totalApartments).toBe(3);
    expect(summary.occupiedApartments).toBe(1); // only the still-active stay
    expect(summary.vacantApartments).toBe(2);
    expect(summary.occupancyRate).toBe(33); // 1/3 rounded
    expect(summary.totalResidents).toBe(2);
    expect(summary.activeLeases).toBe(2);
  });

  it('counts expiring leases inside the 30-day window only', async () => {
    const building = await seedBuilding('Amman Heights');
    const in29 = await seedApartment(building, '201');
    const in31 = await seedApartment(building, '202');
    const past = await seedApartment(building, '203');
    const r1 = await seedResident('R1');
    const r2 = await seedResident('R2');
    const r3 = await seedResident('R3');
    await seedActiveLease(in29, r1.id, 29); // inside window
    await seedActiveLease(in31, r2.id, 31); // outside window
    await seedActiveLease(past, r3.id, -1); // already ended → not "expiring"

    const summary = await world.getDashboardSummary.execute(actorA);
    expect(summary.expiringLeases).toBe(1);
    expect(summary.activeLeases).toBe(3);
  });

  it('never mixes tenants', async () => {
    await seedBuilding('Mine');
    await seedBuilding('Foreign', TENANT_B);
    await seedResident('Foreign R', TENANT_B);

    const mine = await world.getDashboardSummary.execute(actorA);
    expect(mine.totalBuildings).toBe(1);
    const theirs = await world.getDashboardSummary.execute(actorB);
    expect(theirs.totalBuildings).toBe(1);
    expect(theirs.totalResidents).toBe(1);
  });
});

describe('GetBuildingSummaries — building cards', () => {
  it('aggregates per building with occupancy percentage', async () => {
    const full = await seedBuilding('Alpha');
    await seedBuilding('Beta'); // stays empty
    const a1 = await seedApartment(full, '101');
    await seedApartment(full, '102'); // stays vacant
    const resident = await seedResident('Sara');
    const lease = await seedActiveLease(a1, resident.id, 100);
    await seedOccupancy(a1, resident.id, lease.id);

    const cards = await world.getBuildingSummaries.execute(actorA);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      name: 'Alpha',
      apartmentCount: 2,
      occupied: 1,
      vacant: 1,
      occupancyPercent: 50,
    });
    expect(cards[0].address).toContain('Alpha Street');
    expect(cards[1]).toMatchObject({
      name: 'Beta',
      apartmentCount: 0,
      occupied: 0,
      vacant: 0,
      occupancyPercent: 0,
    });
  });
});

describe('GetLeaseAlerts — expiring and expired', () => {
  it('splits leases into expiring-soon (soonest first) and expired', async () => {
    const building = await seedBuilding('Amman Heights');
    const soonUnit = await seedApartment(building, '301');
    const soonerUnit = await seedApartment(building, '302');
    const okUnit = await seedApartment(building, '303');
    const deadUnit = await seedApartment(building, '304');
    const r1 = await seedResident('R1');
    const r2 = await seedResident('R2');
    const r3 = await seedResident('R3');
    const r4 = await seedResident('R4');

    await seedActiveLease(soonUnit, r1.id, 20, 'LC-SOON');
    await seedActiveLease(soonerUnit, r2.id, 5, 'LC-SOONER');
    await seedActiveLease(okUnit, r3.id, 200, 'LC-OK');
    await seedActiveLease(deadUnit, r4.id, -10, 'LC-DEAD'); // past end, still Active

    const alerts = await world.getLeaseAlerts.execute(actorA);
    expect(alerts.expiringSoon.map((l) => l.contractNumber)).toEqual(['LC-SOONER', 'LC-SOON']);
    expect(alerts.expired.map((l) => l.contractNumber)).toEqual(['LC-DEAD']);
  });

  it('includes leases already marked Expired', async () => {
    const building = await seedBuilding('Amman Heights');
    const unit = await seedApartment(building, '401');
    const resident = await seedResident('R1');
    const lease = await seedActiveLease(unit, resident.id, -5, 'LC-MARKED');
    const loaded = (await world.leases.findById(TENANT_A, lease.id))!;
    loaded.expire(USER_A, world.clock);
    await world.leases.save(loaded);

    const alerts = await world.getLeaseAlerts.execute(actorA);
    expect(alerts.expired.map((l) => l.contractNumber)).toEqual(['LC-MARKED']);
    expect(alerts.expiringSoon).toHaveLength(0);
  });
});

describe('GetRecentActivity — feed', () => {
  it('lists all six event types newest first and honors the limit', async () => {
    const building = await seedBuilding('Amman Heights'); // t0: BuildingCreated (+ApartmentAdded later)
    world.clock.advance(60_000);
    const unit = await seedApartment(building, '101'); // t1: ApartmentAdded
    world.clock.advance(60_000);
    const resident = await seedResident('Sara Khalil'); // t2: ResidentRegistered
    world.clock.advance(60_000);
    const lease = await seedActiveLease(unit, resident.id, 90, 'LC-FEED'); // t3: LeaseCreated
    world.clock.advance(60_000);
    const stay = await seedOccupancy(unit, resident.id, lease.id); // t4: MoveIn
    world.clock.advance(60_000);
    stay.close(world.clock.now(), 'left', USER_A, world.clock); // t5: MoveOut
    await world.occupancies.save(stay);

    const feed = await world.getRecentActivity.execute(actorA, 10);
    expect(feed.map((item) => item.type)).toEqual([
      'MoveOut',
      'MoveIn',
      'LeaseCreated',
      'ResidentRegistered',
      'ApartmentAdded',
      'BuildingCreated',
    ]);
    expect(feed[0].description).toBe('Move-out — unit 101');
    expect(feed[2].description).toBe('Lease LC-FEED created');
    expect(feed[3].description).toBe('Resident Sara Khalil registered');

    const limited = await world.getRecentActivity.execute(actorA, 2);
    expect(limited).toHaveLength(2);
    expect(limited.map((item) => item.type)).toEqual(['MoveOut', 'MoveIn']);
  });

  it('is tenant-scoped', async () => {
    await seedBuilding('Mine');
    await seedBuilding('Foreign', TENANT_B);

    const feed = await world.getRecentActivity.execute(actorA, 10);
    expect(feed).toHaveLength(1);
    expect(feed[0].description).toBe('Building "Mine" created');
  });
});
