import crypto from 'crypto';
import request from 'supertest';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { createApp } from '@presentation/http/app';
import { buildContainer, setContainer } from '@presentation/http/container';
import { buildTestWorld, TestWorld } from './fakes';

const app = createApp();

const TENANT_A = crypto.randomUUID();
const TENANT_B = crypto.randomUUID();

const MANAGER_PERMISSIONS = [
  'buildings.read',
  'buildings.manage',
  'apartments.read',
  'apartments.manage',
  'owners.read',
  'owners.manage',
  'residents.read',
  'residents.manage',
  'leases.read',
  'leases.manage',
  'occupancy.read',
  'occupancy.manage',
  'dashboard.read',
];

const mintToken = (tenantId: string | null, permissions = MANAGER_PERMISSIONS): string =>
  tokenService.signAccessToken({
    sub: crypto.randomUUID(),
    name: 'Dashboard Manager',
    roles: ['BuildingManager'],
    permissions,
    tenantId,
  });

const managerA = mintToken(TENANT_A);
const managerB = mintToken(TENANT_B);
const noDashboard = mintToken(TENANT_A, ['buildings.read']);

let world: TestWorld;

beforeEach(() => {
  world = buildTestWorld();
  setContainer(buildContainer(world.deps));
});

const post = (url: string, body: object, token = managerA): request.Test =>
  request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
const get = (url: string, token = managerA): request.Test =>
  request(app).get(url).set('Authorization', `Bearer ${token}`);

/** Runs the full pilot workflow through the API: 1 building, 2 units, 1 move-in. */
const seedPortfolio = async (): Promise<void> => {
  const building = await post('/api/v1/buildings', {
    name: 'Amman Heights',
    address: '12 Rainbow Street, Amman',
    city: 'Amman',
    totalFloors: 4,
  });
  const floor = await post(`/api/v1/buildings/${building.body.data.id}/floors`, {
    floorNumber: 1,
  });
  const owner = await post('/api/v1/owners', { fullName: 'Owner One' });
  const makeUnit = async (unitNumber: string): Promise<string> => {
    const apartment = await post('/api/v1/apartments', {
      buildingId: building.body.data.id,
      floorId: floor.body.data.id,
      unitNumber,
    });
    await request(app)
      .put(`/api/v1/apartments/${apartment.body.data.id}`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ ownerId: owner.body.data.id });
    return apartment.body.data.id as string;
  };
  const unitA = await makeUnit('101');
  await makeUnit('102');

  const resident = await post('/api/v1/residents', {
    fullName: 'Sara Khalil',
    phoneNumber: '+962790000001',
  });
  const today = new Date();
  const lease = await post('/api/v1/leases', {
    apartmentId: unitA,
    residentId: resident.body.data.id,
    startDate: today.toISOString().slice(0, 10),
    endDate: new Date(today.getTime() + 20 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    monthlyRent: 450,
  });
  const moveIn = await post('/api/v1/occupancy/move-in', { leaseId: lease.body.data.id });
  expect(moveIn.status).toBe(201);
};

describe('dashboard authorization', () => {
  it('requires authentication and the dashboard.read permission', async () => {
    expect((await request(app).get('/api/v1/dashboard/summary')).status).toBe(401);

    const forbidden = await get('/api/v1/dashboard/summary', noDashboard);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });
});

describe('GET /dashboard/summary', () => {
  it('reflects the seeded portfolio with aggregated numbers', async () => {
    await seedPortfolio();

    const response = await get('/api/v1/dashboard/summary');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      totalBuildings: 1,
      totalApartments: 2,
      occupiedApartments: 1,
      vacantApartments: 1,
      totalOwners: 1,
      totalResidents: 1,
      activeLeases: 1,
      expiringLeases: 1, // lease ends in 20 days
      openMaintenanceRequests: 0,
      occupancyRate: 50,
    });
  });

  it('is tenant-isolated', async () => {
    await seedPortfolio();
    const foreign = await get('/api/v1/dashboard/summary', managerB);
    expect(foreign.body.data.totalBuildings).toBe(0);
    expect(foreign.body.data.totalApartments).toBe(0);
  });
});

describe('GET /dashboard/buildings', () => {
  it('returns one card per building with occupancy percentage', async () => {
    await seedPortfolio();

    const response = await get('/api/v1/dashboard/buildings');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      name: 'Amman Heights',
      address: '12 Rainbow Street, Amman',
      apartmentCount: 2,
      occupied: 1,
      vacant: 1,
      occupancyPercent: 50,
    });
  });
});

describe('GET /dashboard/lease-alerts', () => {
  it('flags the lease expiring within 30 days', async () => {
    await seedPortfolio();

    const response = await get('/api/v1/dashboard/lease-alerts');
    expect(response.status).toBe(200);
    expect(response.body.data.expiringSoon).toHaveLength(1);
    expect(response.body.data.expired).toHaveLength(0);
  });
});

describe('GET /dashboard/activity', () => {
  it('lists the workflow events newest first', async () => {
    await seedPortfolio();

    const response = await get('/api/v1/dashboard/activity?limit=20');
    expect(response.status).toBe(200);
    const types = response.body.data.map((item: { type: string }) => item.type);
    // Everything seeded in the same clock instant — all types must appear
    expect(new Set(types)).toEqual(
      new Set([
        'BuildingCreated',
        'ApartmentAdded',
        'ResidentRegistered',
        'LeaseCreated',
        'MoveIn',
      ]),
    );
    expect(types[0]).toBeDefined();
    const timestamps = response.body.data.map((item: { occurredAt: string }) => item.occurredAt);
    const sorted = [...timestamps].sort((a, b) => (a < b ? 1 : -1));
    expect(timestamps).toEqual(sorted); // newest first
  });

  it('validates the limit parameter', async () => {
    const tooBig = await get('/api/v1/dashboard/activity?limit=500');
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.code).toBe('VALIDATION_ERROR');
  });
});
