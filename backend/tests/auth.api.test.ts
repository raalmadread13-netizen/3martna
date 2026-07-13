import bcrypt from 'bcryptjs';
import request from 'supertest';

jest.mock('../src/config/db', () => ({
  execProc: jest.fn(),
  execProcOne: jest.fn(),
  getPool: jest.fn(),
  closePool: jest.fn(),
}));
jest.mock('../src/config/firebase', () => ({
  getFirebase: () => null,
  getMessaging: () => null,
  verifyFirebaseIdToken: jest.fn().mockResolvedValue(null),
}));

import { execProc, execProcOne } from '../src/config/db';
import { createApp } from '../src/app';

const mockExecProc = execProc as jest.Mock;
const mockExecProcOne = execProcOne as jest.Mock;

const app = createApp();
const passwordHash = bcrypt.hashSync('Password123!', 4);

const dbUser = {
  UserId: 7,
  PublicId: 'a-guid',
  FullName: 'Sara Tenant',
  Email: 'sara@example.com',
  Phone: '+962790000003',
  PasswordHash: passwordHash,
  PreferredLanguage: 'ar',
  IsActive: true,
  IsPhoneVerified: true,
  ProfileImageUrl: null,
  Roles: 'Tenant',
};

beforeEach(() => {
  mockExecProc.mockResolvedValue({ recordset: [], recordsets: [[]] });
});

describe('POST /api/v1/auth/login', () => {
  it('returns tokens and user profile for valid credentials', async () => {
    mockExecProcOne.mockResolvedValueOnce(dbUser); // sp_User_GetForLogin

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '+962790000003', password: 'Password123!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tokens.accessToken).toBeTruthy();
    expect(response.body.data.tokens.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(response.body.data.user.Roles).toEqual(['Tenant']);
    expect(response.body.data.user.PasswordHash).toBeUndefined();
  });

  it('rejects a wrong password with 401 and no user detail leakage', async () => {
    mockExecProcOne.mockResolvedValueOnce(dbUser);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '+962790000003', password: 'WrongPass123!' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown identifier with the same 401 (no enumeration)', async () => {
    mockExecProcOne.mockResolvedValueOnce(null);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ghost@example.com', password: 'Password123!' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects disabled accounts with 403', async () => {
    mockExecProcOne.mockResolvedValueOnce({ ...dbUser, IsActive: false });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '+962790000003', password: 'Password123!' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('validates the payload (400 on missing password)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'x@example.com' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/register', () => {
  it('creates an account and returns 201 with tokens', async () => {
    mockExecProcOne.mockResolvedValueOnce({ ...dbUser, PasswordHash: undefined }); // sp_User_Create
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Sara Tenant',
      phone: '+962790000003',
      password: 'Password123!',
      role: 'Tenant',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.tokens.accessToken).toBeTruthy();
  });

  it('blocks privileged self-registration', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Evil Admin',
      phone: '+962790000099',
      password: 'Password123!',
      role: 'SystemAdmin',
    });
    expect(response.status).toBe(400); // Joi rejects the role before the service
  });

  it('maps SQL duplicate-phone errors to 409', async () => {
    mockExecProcOne.mockRejectedValueOnce(new Error('PHONE_ALREADY_EXISTS'));
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Sara Tenant',
      phone: '+962790000003',
      password: 'Password123!',
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PHONE_ALREADY_EXISTS');
  });
});

describe('protected routes', () => {
  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/v1/users/me');
    expect(response.status).toBe(401);
  });

  it('rejects requests with a garbage token', async () => {
    const response = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('TOKEN_INVALID');
  });

  it('enforces role-based authorization (tenant cannot list users)', async () => {
    mockExecProcOne.mockResolvedValueOnce(dbUser);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '+962790000003', password: 'Password123!' });
    const token = login.body.data.tokens.accessToken as string;

    const response = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
