import crypto from 'crypto';

/** Cryptographically random numeric code, zero-padded (e.g. '048371'). */
export const generateNumericCode = (digits = 6): string =>
  crypto
    .randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, '0');

/** Max wrong attempts before a verification code is invalidated. */
export const MAX_CODE_ATTEMPTS = 5;
