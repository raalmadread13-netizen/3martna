import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';

const BCRYPT_ROUNDS = 12;

/** bcrypt implementation of the password-hashing contract. */
export class BcryptPasswordHasher implements IPasswordHasher {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export const passwordHasher = new BcryptPasswordHasher();
