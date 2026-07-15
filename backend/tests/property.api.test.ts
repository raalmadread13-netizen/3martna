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
];

/** Signs a real access token — the API trusts only the verified payload. */
const mintToken = (tenantId: string | null, permissions: string[] = MANAGER_PERMISSIONS): string =>
  tokenService.signAccessToken({
    sub: crypto.randomUUID(),
    name: 'Test Manager',
    roles: ['BuildingManager'],
    permissions,
    tenantId,
  });

const managerA = mintToken(TENANT_A);
const managerB = mintToken(TENANT_B);
const readerA = mintToken(TENANT_A, ['buildings.read', 'apartments.read', 'owners.read']);
const noTenant = mintToken(null);

let world: TestWorld;

beforeEach(() => {
  world = buildTestWorld();
  setContainer(buildContainer(world.deps));
});

const buildingBody = {
  name: 'Amman Heights',
  address: '12 Rainbow Street, Amman',
  city: 'Amman',
  totalFloors: 6,
};

const createBuilding = async (token = managerA, body = buildingBody): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/buildings')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  expect(response.status).toBe(201);
  return response.body.data.id as string;
};

const addFloor = async (buildingId: string, floorNumber = 1, token = managerA): Promise<string> => {
  const response = await request(app)
    .post(`/api/v1/buildings/${buildingId}/floors`)
    .set('Authorization', `Bearer ${token}`)
    .send({ floorNumber });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
};

const createApartment = async (
  buildingId: string,
  floorId: string,
  unitNumber = '101',
): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/apartments')
    .set('Authorization', `Bearer ${managerA}`)
    .send({ buildingId, floorId, unitNumber });
  expect(response.status).toBe(201);
  return response.body.data.id as string;
};

describe('authorization & tenant guards', () => {
  it('rejects unauthenticated requests (401)', async () => {
    expect((await request(app).get('/api/v1/buildings')).status).toBe(401);
    expect((await request(app).post('/api/v1/owners').send({})).status).toBe(401);
  });

  it('rejects callers without the manage permission (403)', async () => {
    const response = await request(app)
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${readerA}`)
      .send(buildingBody);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('read permission is enough for listing', async () => {
    const response = await request(app)
      .get('/api/v1/buildings')
      .set('Authorization', `Bearer ${readerA}`);
    expect(response.status).toBe(200);
  });

  it('rejects platform accounts without a tenant (403 TENANT_CONTEXT_REQUIRED)', async () => {
    const response = await request(app)
      .get('/api/v1/buildings')
      .set('Authorization', `Bearer ${noTenant}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TENANT_CONTEXT_REQUIRED');
  });
});

describe('buildings API', () => {
  it('creates, reads, updates and lists buildings', async () => {
    const id = await createBuilding();

    const details = await request(app)
      .get(`/api/v1/buildings/${id}`)
      .set('Authorization', `Bearer ${managerA}`);
    expect(details.status).toBe(200);
    expect(details.body.data).toMatchObject({ name: 'Amman Heights', floors: [] });

    const updated = await request(app)
      .put(`/api/v1/buildings/${id}`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ notes: 'Renovated 2025' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.notes).toBe('Renovated 2025');

    const list = await request(app)
      .get('/api/v1/buildings?page=1&pageSize=10')
      .set('Authorization', `Bearer ${managerA}`);
    expect(list.status).toBe(200);
    expect(list.body.pagination.totalCount).toBe(1);
  });

  it('validates the payload (400) and GUID params', async () => {
    const bad = await request(app)
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ name: 'X' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');

    const badId = await request(app)
      .get('/api/v1/buildings/not-a-guid')
      .set('Authorization', `Bearer ${managerA}`);
    expect(badId.status).toBe(400);
  });

  it('returns 409 for duplicate names within the tenant', async () => {
    await createBuilding();
    const response = await request(app)
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${managerA}`)
      .send(buildingBody);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('BUILDING_NAME_TAKEN');
  });

  it('keeps tenants isolated end to end', async () => {
    const id = await createBuilding();

    // Same name is fine for tenant B; tenant A's building is invisible to B
    const created = await request(app)
      .post('/api/v1/buildings')
      .set('Authorization', `Bearer ${managerB}`)
      .send(buildingBody);
    expect(created.status).toBe(201);

    const crossRead = await request(app)
      .get(`/api/v1/buildings/${id}`)
      .set('Authorization', `Bearer ${managerB}`);
    expect(crossRead.status).toBe(404);

    const listB = await request(app)
      .get('/api/v1/buildings')
      .set('Authorization', `Bearer ${managerB}`);
    expect(listB.body.pagination.totalCount).toBe(1);
  });

  it('archives via DELETE only when no apartments remain (409 first)', async () => {
    const buildingId = await createBuilding();
    const floorId = await addFloor(buildingId);
    const apartmentId = await createApartment(buildingId, floorId);

    const blocked = await request(app)
      .delete(`/api/v1/buildings/${buildingId}`)
      .set('Authorization', `Bearer ${managerA}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('BUILDING_HAS_APARTMENTS');

    await request(app)
      .delete(`/api/v1/apartments/${apartmentId}`)
      .set('Authorization', `Bearer ${managerA}`)
      .expect(200);

    await request(app)
      .delete(`/api/v1/buildings/${buildingId}`)
      .set('Authorization', `Bearer ${managerA}`)
      .expect(200);

    await request(app)
      .get(`/api/v1/buildings/${buildingId}`)
      .set('Authorization', `Bearer ${managerA}`)
      .expect(404);
  });
});

describe('floors API', () => {
  it('adds, renames and lists floors; duplicates are 409', async () => {
    const buildingId = await createBuilding();
    const floorId = await addFloor(buildingId, 1);

    const duplicate = await request(app)
      .post(`/api/v1/buildings/${buildingId}/floors`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ floorNumber: 1 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('FLOOR_NUMBER_TAKEN');

    const renamed = await request(app)
      .put(`/api/v1/buildings/${buildingId}/floors/${floorId}`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ name: 'Ground' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Ground');

    const list = await request(app)
      .get(`/api/v1/buildings/${buildingId}/floors`)
      .set('Authorization', `Bearer ${managerA}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });
});

describe('apartments API', () => {
  it('creates apartments and enforces unit uniqueness (409)', async () => {
    const buildingId = await createBuilding();
    const floorId = await addFloor(buildingId);
    await createApartment(buildingId, floorId, '101');

    const duplicate = await request(app)
      .post('/api/v1/apartments')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ buildingId, floorId, unitNumber: '101' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('UNIT_NUMBER_TAKEN');
  });

  it('404s when the floor does not belong to the building', async () => {
    const buildingId = await createBuilding();
    await addFloor(buildingId);
    const otherBuilding = await createBuilding(managerA, { ...buildingBody, name: 'Petra Tower' });
    const foreignFloor = await addFloor(otherBuilding, 1);

    const response = await request(app)
      .post('/api/v1/apartments')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ buildingId, floorId: foreignFloor, unitNumber: '101' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('FLOOR_NOT_FOUND');
  });

  it('updates details/status and rejects illegal transitions with 422', async () => {
    const buildingId = await createBuilding();
    const floorId = await addFloor(buildingId);
    const apartmentId = await createApartment(buildingId, floorId);

    const leased = await request(app)
      .put(`/api/v1/apartments/${apartmentId}`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ status: 'Leased', baseRentAmount: 500 });
    expect(leased.status).toBe(200);
    expect(leased.body.data.status).toBe('Leased');

    const illegal = await request(app)
      .put(`/api/v1/apartments/${apartmentId}`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ status: 'Reserved' });
    expect(illegal.status).toBe(422);
    expect(illegal.body.code).toBe('UNIT_TRANSITION');
  });

  it('lists by building filter and enforces tenant isolation', async () => {
    const buildingId = await createBuilding();
    const floorId = await addFloor(buildingId);
    const apartmentId = await createApartment(buildingId, floorId);

    const list = await request(app)
      .get(`/api/v1/apartments?buildingId=${buildingId}`)
      .set('Authorization', `Bearer ${managerA}`);
    expect(list.status).toBe(200);
    expect(list.body.pagination.totalCount).toBe(1);

    await request(app)
      .get(`/api/v1/apartments/${apartmentId}`)
      .set('Authorization', `Bearer ${managerB}`)
      .expect(404);
  });
});

describe('owners API', () => {
  it('creates, reads, updates and lists owners', async () => {
    const created = await request(app)
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ fullName: 'Layla Haddad', email: 'layla@example.com' });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const updated = await request(app)
      .put(`/api/v1/owners/${id}`)
      .set('Authorization', `Bearer ${managerA}`)
      .send({ phoneNumber: '+962790001122' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.phoneNumber).toBe('+962790001122');

    const list = await request(app)
      .get('/api/v1/owners')
      .set('Authorization', `Bearer ${managerA}`);
    expect(list.body.pagination.totalCount).toBe(1);

    await request(app)
      .get(`/api/v1/owners/${id}`)
      .set('Authorization', `Bearer ${managerB}`)
      .expect(404);
  });

  it('maps the Company-without-name invariant to 422', async () => {
    const response = await request(app)
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${managerA}`)
      .send({ ownerType: 'Company', fullName: 'ACME Holding' });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('OWNER_COMPANY');
  });
});
