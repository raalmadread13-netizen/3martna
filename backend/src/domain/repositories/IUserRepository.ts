import { NewUser, User } from '@domain/entities/User';

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  /** Login lookup — matches email OR phone number, excluding soft-deleted rows. */
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  emailExists(email: string): Promise<boolean>;
  phoneExists(phoneNumber: string): Promise<boolean>;
  create(user: NewUser): Promise<User>;
  setPasswordHash(userId: number, passwordHash: string, updatedBy: number | null): Promise<void>;
  /** Reset failure counters and stamp LastLoginAt. */
  recordLoginSuccess(userId: number): Promise<void>;
  /** Increment failure counter; lock the account when the threshold is hit. */
  recordLoginFailure(userId: number, maxAttempts: number, lockMinutes: number): Promise<void>;
  setEmailVerified(userId: number): Promise<void>;
  setPhoneVerified(userId: number): Promise<void>;
}
