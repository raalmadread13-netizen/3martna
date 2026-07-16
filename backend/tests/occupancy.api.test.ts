import crypto from 'crypto';
import request from 'supertest';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { createApp } from '@presentation/http/app';
import { buildContainer, setContainer } from '@presentation/http/container';
import { buildTestWorld, TestWorld } from './fakes';

const app = createApp();

const TENANT_A = crypto.randomUUID();
const TENANT_B = crypto.randomUUID();

const ALL_PERMISSIONS = [
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
];

const mintToken = (tenantId: string | null, permissions = ALL_PERMISSIONS): string =>
  tokenService.signAccessToken({
    sub: crypto.randomUUID(),
    name: 'Occupancy Manager',
    roles: ['BuildingManager'],
    permissions,
    tenantId,
  });

const managerA = mintToken(TENANT_A);
const managerB = mintToken(TENANT_B);
const readerA = mintToken(TENANT_A, ['residents.read', 'leases.read', 'occupancy.read']);

let world: TestWorld;

beforeEach(() => {
  world = buildTestWorld();
  setContainer(buildContainer(world.deps));
});

const post = (url: string, body: object, token = managerA): request.Test =>
  request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
const get = (url: string, token = managerA): request.Test =>
  request(app).get(url).set('Authorization', `Bearer ${token}`);

/** Seeds building/floor/apartment(+owner) through the API; returns ids. */
const seedApartment = async (unitNumber = '101'): Promise<string> => {
  const building = await post('/api/v1/buildings', {
    name: `Building ${unitNumber}-${Math.random().toString(36).slice(2, 8)}`,
    address: '12 Rainbow Street, Amman',
    city: 'Amman',
    totalFloors: 4,
  });
  expect(building.status).toBe(201);
  const floor = await post(`/api/v1/buildings/${building.body.data.id}/floors`, { floorNumber: 1 });
  const owner = await post('/api/v1/owners', { fullName: 'Owner One' });
  const apartment = await post('/api/v1/apartments', {
    buildingId: building.body.data.id,
    floorId: floor.body.data.id,
    unitNumber,
  });
  expect(apartment.status).toBe(201);
  const updated = await request(app)
    .put(`/api/v1/apartments/${apartment.body.data.id}`)
    .set('Authorization', `Bearer ${managerA}`)
    .send({ ownerId: owner.body.data.id });
  expect(updated.status).toBe(200);
  return apartment.body.data.id as string;
};

const registerResident = async (
  fullName = 'Sara Khalil',
  phone = '+962790000001',
): Promise<string> => {
  const response = await post('/api/v1/residents', { fullName, phoneNumber: phone });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
};

const createLease = async (apartmentId: string, residentId: string): Promise<string> => {
  const response = await post('/api/v1/leases', {
    apartmentId,
    residentId,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    monthlyRent: 450,
  });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
};

describe('RFC 7807 Problem Details', () => {
  it('renders 401 as application/problem+json with the standard members', async () => {
    const response = await request(app).get('/api/v1/residents');
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      type: expect.stringContaining('https://api.3martna.jo/problems/'),
      title: 'Unauthorized',
      status: 401,
      detail: expect.any(String),
      instance: '/api/v1/residents',
      code: 'UNAUTHORIZED',
      // legacy extensions preserved
      success: false,
      message: expect.any(String),
    });
  });

  it('renders validation failures with field-level errors', async () => {
    const response = await post('/api/v1/residents', { fullName: 'X' });
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('renders business conflicts with 409 and stable codes', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    await createLease(apartmentId, residentId);

    const other = await registerResident('Bilal Odeh', '+962790000002');
    const conflict = await post('/api/v1/leases', {
      apartmentId,
      residentId: other,
      startDate: '2027-02-01',
      endDate: '2028-02-01',
      monthlyRent: 300,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.title).toBe('Conflict');
    expect(conflict.body.code).toBe('APARTMENT_HAS_ACTIVE_LEASE');
  });
});

describe('Idempotency-Key', () => {
  it('replays the stored response instead of creating duplicates', async () => {
    const key = crypto.randomUUID();
    const body = { fullName: 'Sara Khalil', phoneNumber: '+962790000001' };

    const first = await post('/api/v1/residents', body).set('Idempotency-Key', key);
    expect(first.status).toBe(201);

    const second = await post('/api/v1/residents', body).set('Idempotency-Key', key);
    expect(second.status).toBe(201);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body.data.id).toBe(first.body.data.id);

    const list = await get('/api/v1/residents');
    expect(list.body.data).toHaveLength(1); // no duplicate was created
  });

  it('rejects key reuse with a different payload (422)', async () => {
    const key = crypto.randomUUID();
    await post('/api/v1/residents', { fullName: 'Sara Khalil', phoneNumber: '+962790000001' }).set(
      'Idempotency-Key',
      key,
    );
    const reused = await post('/api/v1/residents', {
      fullName: 'Someone Else',
      phoneNumber: '+962790000002',
    }).set('Idempotency-Key', key);
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('does not replay failed executions — clients may retry after errors', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    await createLease(apartmentId, residentId);

    const key = crypto.randomUUID();
    const conflictBody = {
      apartmentId,
      residentId: await registerResident('Bilal Odeh', '+962790000002'),
      startDate: '2027-02-01',
      endDate: '2028-02-01',
      monthlyRent: 300,
    };
    const failed = await post('/api/v1/leases', conflictBody).set('Idempotency-Key', key);
    expect(failed.status).toBe(409); // business conflict, key released

    const retried = await post('/api/v1/leases', conflictBody).set('Idempotency-Key', key);
    expect(retried.status).toBe(409);
    expect(retried.headers['idempotency-replayed']).toBeUndefined();
  });
});

describe('cursor list endpoints (search / filter / sort)', () => {
  it('walks residents with a cursor and never repeats or skips', async () => {
    for (const [name, phone] of [
      ['Aisha Zaid', '+962790000001'],
      ['Bilal Odeh', '+962790000002'],
      ['Carmen Haddad', '+962790000003'],
    ] as const) {
      await post('/api/v1/residents', { fullName: name, phoneNumber: phone });
    }

    const first = await get('/api/v1/residents?limit=2&sortBy=fullName&sortDir=asc');
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await get(
      `/api/v1/residents?limit=2&sortBy=fullName&sortDir=asc&cursor=${encodeURIComponent(
        first.body.nextCursor as string,
      )}`,
    );
    expect(second.body.data).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const names = [...first.body.data, ...second.body.data].map(
      (r: { fullName: string }) => r.fullName,
    );
    expect(names).toEqual(['Aisha Zaid', 'Bilal Odeh', 'Carmen Haddad']);
  });

  it('searches residents and filters leases by status', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident('Carmen Haddad', '+962790000003');
    const leaseId = await createLease(apartmentId, residentId);

    const found = await get('/api/v1/residents?search=carmen');
    expect(found.body.data).toHaveLength(1);

    const active = await get('/api/v1/leases?status=Active');
    expect(active.body.data).toHaveLength(1);

    await post(`/api/v1/leases/${leaseId}/terminate`, { reason: 'Testing filters' });
    const activeAfter = await get('/api/v1/leases?status=Active');
    expect(activeAfter.body.data).toHaveLength(0);
  });

  it('rejects unknown sort fields (400)', async () => {
    const response = await get('/api/v1/residents?sortBy=passwordHash');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('occupancy workflow over REST', () => {
  it('move-in → history → move-out, with apartment status following', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    const leaseId = await createLease(apartmentId, residentId);

    const movedIn = await post('/api/v1/occupancy/move-in', { leaseId });
    expect(movedIn.status).toBe(201);
    const occupancyId = movedIn.body.data.id as string;

    const apartment = await get(`/api/v1/apartments/${apartmentId}`);
    expect(apartment.body.data.status).toBe('Leased');

    const active = await get(`/api/v1/occupancy?apartmentId=${apartmentId}&active=true`);
    expect(active.body.data).toHaveLength(1);

    const movedOut = await post(`/api/v1/occupancy/${occupancyId}/move-out`, {
      moveOutDate: '2026-05-01',
      reason: 'Relocation',
    });
    expect(movedOut.status).toBe(200);
    expect(movedOut.body.data.isActive).toBe(false);

    const after = await get(`/api/v1/apartments/${apartmentId}`);
    expect(after.body.data.status).toBe('Available');

    // History remains queryable
    const history = await get(`/api/v1/occupancy?apartmentId=${apartmentId}`);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].moveOutReason).toBe('Relocation');
  });

  it('terminating the lease over REST closes the occupancy', async () => {
    const apartmentId = await seedApartment();
    const residentId = await registerResident();
    const leaseId = await createLease(apartmentId, residentId);
    const movedIn = await post('/api/v1/occupancy/move-in', { leaseId });

    const terminated = await post(`/api/v1/leases/${leaseId}/terminate`, { reason: 'Breach' });
    expect(terminated.status).toBe(200);
    expect(terminated.body.data.status).toBe('Terminated');

    const occupancy = await get(`/api/v1/occupancy/${movedIn.body.data.id}`);
    expect(occupancy.body.data.isActive).toBe(false);
  });

  it('enforces permissions and tenant isolation', async () => {
    const denied = await post(
      '/api/v1/residents',
      { fullName: 'X Y', phoneNumber: '+962790000001' },
      readerA,
    );
    expect(denied.status).toBe(403);

    const residentId = await registerResident();
    const crossTenant = await get(`/api/v1/residents/${residentId}`, managerB);
    expect(crossTenant.status).toBe(404);

    const foreignList = await get('/api/v1/residents', managerB);
    expect(foreignList.body.data).toHaveLength(0);
  });
});
