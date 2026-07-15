import { NewUser, User } from '@domain/entities/User';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  /** Login lookup — matches email OR phone number, excluding soft-deleted rows. */
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  emailExists(email: string): Promise<boolean>;
  phoneExists(phoneNumber: string): Promise<boolean>;
  create(user: NewUser): Promise<User>;
  setPasswordHash(userId: string, passwordHash: string, updatedBy: string | null): Promise<void>;
  /** Reset failure counters and stamp LastLoginAt. */
  recordLoginSuccess(userId: string): Promise<void>;
  /** Increment failure counter; lock the account when the threshold is hit. */
  recordLoginFailure(userId: string, maxAttempts: number, lockMinutes: number): Promise<void>;
  setEmailVerified(userId: string): Promise<void>;
  setPhoneVerified(userId: string): Promise<void>;
}
