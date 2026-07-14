import request from 'supertest';
import { createApp } from '@presentation/http/app';
import { buildContainer, setContainer } from '@presentation/http/container';
import { buildTestWorld, TestWorld } from './fakes';

const app = createApp();

const registerBody = {
  firstName: 'Sara',
  lastName: 'Khalil',
  email: 'sara@example.com',
  phoneNumber: '+962790001111',
  password: 'Password123',
};

let world: TestWorld;

beforeEach(() => {
  world = buildTestWorld();
  setContainer(buildContainer(world.deps));
});

const register = (): request.Test => request(app).post('/api/v1/auth/register').send(registerBody);
const login = (
  identifier = registerBody.phoneNumber,
  password = registerBody.password,
): request.Test => request(app).post('/api/v1/auth/login').send({ identifier, password });

describe('POST /api/v1/auth/register', () => {
  it('creates an account with the Resident role and returns tokens', async () => {
    const response = await register();
    expect(response.status).toBe(201);
    expect(response.body.data.user.roles).toEqual(['Resident']);
    expect(response.body.data.user.permissions).toContain('profile.manage');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.tokens.accessToken).toBeTruthy();
    expect(response.body.data.tokens.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects duplicate phone numbers with 409', async () => {
    await register();
    const response = await register();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('rejects weak passwords with the policy failures', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerBody, password: 'password' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('WEAK_PASSWORD');
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('validates the payload shape (400)', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ firstName: 'X' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('logs in with phone or email', async () => {
    expect((await login(registerBody.phoneNumber)).status).toBe(200);
    expect((await login(registerBody.email)).status).toBe(200);
  });

  it('returns the same generic 401 for wrong password and unknown user', async () => {
    const wrongPassword = await login(registerBody.phoneNumber, 'WrongPass123');
    const unknownUser = await login('ghost@example.com', 'Password123');
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknownUser.body.code).toBe(wrongPassword.body.code);
    expect(unknownUser.body.message).toBe(wrongPassword.body.message);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the profile with roles + permissions for a valid token', async () => {
    const { body } = await register();
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.data.tokens.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.phoneNumber).toBe(registerBody.phoneNumber);
    expect(response.body.data.roles).toEqual(['Resident']);
  });

  it('rejects missing/garbage tokens', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer junk')).status,
    ).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh + logout', () => {
  it('rotates the refresh token; the old one is rejected and sessions revoked', async () => {
    const { body } = await register();
    const oldToken = body.data.tokens.refreshToken as string;

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(oldToken);

    const replayed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldToken });
    expect(replayed.status).toBe(401);
    // Reuse detection nuked every session, including the freshly rotated one
    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { body } = await register();
    const { accessToken, refreshToken } = body.data.tokens;

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('password reset flow', () => {
  it('forgot → reset with code → old sessions revoked → login with new password', async () => {
    const { body } = await register();
    const oldRefresh = body.data.tokens.refreshToken as string;

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: registerBody.email });
    expect(forgot.status).toBe(200);
    const code = forgot.body.data.devCode as string; // exposed outside production
    expect(code).toMatch(/^\d{6}$/);
    expect(world.email.sent).toHaveLength(1); // delivered to the account email

    const reset = await request(app).post('/api/v1/auth/reset-password').send({
      identifier: registerBody.email,
      code,
      newPassword: 'NewPassword456',
    });
    expect(reset.status).toBe(200);

    expect(
      (await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh })).status,
    ).toBe(401);
    expect((await login(registerBody.phoneNumber, registerBody.password)).status).toBe(401);
    expect((await login(registerBody.phoneNumber, 'NewPassword456')).status).toBe(200);
  });

  it('never reveals whether the account exists', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: registerBody.email });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);
  });

  it('rejects a wrong code with a generic error and burns attempts', async () => {
    await register();
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: registerBody.email });
    const response = await request(app).post('/api/v1/auth/reset-password').send({
      identifier: registerBody.email,
      code: '000000',
      newPassword: 'NewPassword456',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_RESET_CODE');
    expect(world.verificationCodes.codes[0].attemptCount).toBe(1);
  });
});

describe('email/phone verification flow', () => {
  it('request → confirm marks the email verified', async () => {
    const { body } = await register();
    const token = body.data.tokens.accessToken as string;

    const requested = await request(app)
      .post('/api/v1/auth/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email' });
    expect(requested.status).toBe(200);
    const code = requested.body.data.devCode as string;

    const confirmed = await request(app)
      .post('/api/v1/auth/verification/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email', code });
    expect(confirmed.status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.emailVerified).toBe(true);
  });

  it('phone verification uses SMS delivery', async () => {
    const { body } = await register();
    const token = body.data.tokens.accessToken as string;
    await request(app)
      .post('/api/v1/auth/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'phone' });
    expect(world.sms.sent).toHaveLength(1);
    expect(world.sms.sent[0].to).toBe(registerBody.phoneNumber);
  });

  it('rejects an invalid code', async () => {
    const { body } = await register();
    const token = body.data.tokens.accessToken as string;
    await request(app)
      .post('/api/v1/auth/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email' });
    const response = await request(app)
      .post('/api/v1/auth/verification/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email', code: '000000' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_VERIFICATION_CODE');
  });
});
