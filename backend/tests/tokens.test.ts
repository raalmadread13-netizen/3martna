import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/utils/tokens';

describe('JWT access tokens', () => {
  it('signs and verifies a token with user id, name and roles', () => {
    const token = signAccessToken(42, 'Sara', ['Tenant']);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.name).toBe('Sara');
    expect(payload.roles).toEqual(['Tenant']);
    expect(payload.type).toBe('access');
  });

  it('rejects tampered tokens', () => {
    const token = signAccessToken(1, 'X', ['Tenant']);
    expect(() => verifyAccessToken(token.slice(0, -2) + 'xx')).toThrow();
  });

  it('rejects tokens signed with a different secret', () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ sub: 1, type: 'access' }, 'wrong-secret');
    expect(() => verifyAccessToken(forged)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates a 64-char hex token with a distinct SHA-256 hash', () => {
    const { token, hash, expiresAt } = generateRefreshToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hash).toBe(hashToken(token));
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('produces unique tokens on every call', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();
    expect(first.token).not.toBe(second.token);
  });
});
