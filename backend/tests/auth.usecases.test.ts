import { checkPasswordPolicy } from '@application/auth/passwordPolicy';
import { buildContainer } from '@presentation/http/container';
import { AppError } from '@shared/errors/AppError';
import { buildTestWorld, TestWorld } from './fakes';

const registerInput = {
  firstName: 'Sara',
  lastName: 'Khalil',
  email: 'sara@example.com',
  phoneNumber: '+962790001111',
  password: 'Password123',
  preferredLanguage: 'ar' as const,
  ip: null,
  userAgent: null,
};

describe('password policy', () => {
  it('accepts a compliant password', () => {
    expect(checkPasswordPolicy('Password123').valid).toBe(true);
  });

  it.each([
    ['short', 'Ab1'],
    ['no uppercase', 'password123'],
    ['no lowercase', 'PASSWORD123'],
    ['no digit', 'PasswordAbc'],
  ])('rejects %s', (_label, password) => {
    const result = checkPasswordPolicy(password);
    expect(result.valid).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});

describe('LoginUser — brute force protection', () => {
  let world: TestWorld;

  beforeEach(async () => {
    world = buildTestWorld();
    await buildContainer(world.deps).registerUser.execute(registerInput);
  });

  const login = (password: string): Promise<unknown> =>
    buildContainer(world.deps).loginUser.execute({
      identifier: registerInput.phoneNumber,
      password,
      ip: null,
      userAgent: null,
    });

  it('locks the account after 5 failed attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(login('WrongPass1')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    }
    // 6th attempt — even with the CORRECT password — is locked out
    await expect(login(registerInput.password)).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      statusCode: 429,
    });
    expect(world.auditLogs.actions().filter((action) => action === 'LOGIN_FAILED')).toHaveLength(5);
  });

  it('resets the failure counter on a successful login', async () => {
    await expect(login('WrongPass1')).rejects.toBeInstanceOf(AppError);
    await expect(login(registerInput.password)).resolves.toBeTruthy();
    const user = world.users.users[0];
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
  });

  it('returns the identical error for unknown users (no enumeration)', async () => {
    const unknown = buildContainer(world.deps).loginUser.execute({
      identifier: 'ghost@example.com',
      password: 'Password123',
      ip: null,
      userAgent: null,
    });
    await expect(unknown).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
  });
});

describe('RefreshSession — rotation & reuse detection', () => {
  let world: TestWorld;
  let refreshToken: string;
  let userId: string;

  beforeEach(async () => {
    world = buildTestWorld();
    const result = await buildContainer(world.deps).registerUser.execute(registerInput);
    refreshToken = result.tokens.refreshToken;
    userId = result.user.id;
  });

  it('rotates: old token is revoked, new token works', async () => {
    const container = buildContainer(world.deps);
    const rotated = await container.refreshSession.execute(refreshToken, null);
    expect(rotated.refreshToken).not.toBe(refreshToken);
    expect(rotated.accessToken).toBeTruthy();

    // New token is usable
    await expect(
      container.refreshSession.execute(rotated.refreshToken, null),
    ).resolves.toBeTruthy();
  });

  it('detects reuse of a rotated token and revokes every session', async () => {
    const container = buildContainer(world.deps);
    await container.refreshSession.execute(refreshToken, null); // rotate once

    // Replaying the OLD token = theft signal
    await expect(container.refreshSession.execute(refreshToken, null)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(world.refreshTokens.activeCountFor(userId)).toBe(0);
    expect(world.auditLogs.actions()).toContain('TOKEN_REUSE_DETECTED');
  });

  it('rejects garbage tokens', async () => {
    await expect(
      buildContainer(world.deps).refreshSession.execute('f'.repeat(64), null),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });
});

describe('ChangePassword', () => {
  it('revokes every session after a password change', async () => {
    const world = buildTestWorld();
    const container = buildContainer(world.deps);
    const { user } = await container.registerUser.execute(registerInput);
    await container.loginUser.execute({
      identifier: registerInput.phoneNumber,
      password: registerInput.password,
      ip: null,
      userAgent: null,
    });
    expect(world.refreshTokens.activeCountFor(user.id)).toBe(2); // register + login

    await container.changePassword.execute(user.id, registerInput.password, 'NewPassword456', null);
    expect(world.refreshTokens.activeCountFor(user.id)).toBe(0);

    // Old password no longer works, new one does
    await expect(
      container.loginUser.execute({
        identifier: registerInput.phoneNumber,
        password: registerInput.password,
        ip: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      container.loginUser.execute({
        identifier: registerInput.phoneNumber,
        password: 'NewPassword456',
        ip: null,
        userAgent: null,
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects a weak new password', async () => {
    const world = buildTestWorld();
    const container = buildContainer(world.deps);
    const { user } = await container.registerUser.execute(registerInput);
    await expect(
      container.changePassword.execute(user.id, registerInput.password, 'weak', null),
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
  });
});
