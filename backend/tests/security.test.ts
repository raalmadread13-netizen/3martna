import { BcryptPasswordHasher } from '@infrastructure/security/BcryptPasswordHasher';
import { JwtTokenService } from '@infrastructure/security/JwtTokenService';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes and verifies a password', async () => {
    const hash = await hasher.hash('Str0ng!Password');
    expect(hash).not.toBe('Str0ng!Password');
    expect(await hasher.compare('Str0ng!Password', hash)).toBe(true);
    expect(await hasher.compare('wrong-password', hash)).toBe(false);
  }, 20_000);
});

describe('JwtTokenService', () => {
  const tokens = new JwtTokenService();

  it('signs and verifies an access token round-trip', () => {
    const payload = {
      sub: 42,
      name: 'Sara',
      roles: ['Resident'],
      permissions: ['profile.manage'],
      tenantId: null,
    };
    expect(tokens.verifyAccessToken(tokens.signAccessToken(payload))).toEqual(payload);
  });

  it('rejects tampered tokens', () => {
    const token = tokens.signAccessToken({
      sub: 1,
      name: 'X',
      roles: [],
      permissions: [],
      tenantId: null,
    });
    expect(() => tokens.verifyAccessToken(`${token}x`)).toThrow();
  });

  it('generates unique refresh tokens and stores only hashes', () => {
    const first = tokens.generateRefreshToken();
    const second = tokens.generateRefreshToken();
    expect(first.token).toMatch(/^[0-9a-f]{64}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toBe(tokens.hashToken(first.token));
    expect(first.hash).not.toBe(first.token);
    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
