import {
  NewVerificationCode,
  VerificationCode,
  VerificationPurpose,
} from '@domain/entities/VerificationCode';

export interface IVerificationCodeRepository {
  /** Invalidate previous active codes of the same purpose, then insert. */
  createReplacingActive(code: NewVerificationCode): Promise<void>;
  /** Latest unconsumed, unexpired code for a user + purpose. */
  findActive(userId: number, purpose: VerificationPurpose): Promise<VerificationCode | null>;
  incrementAttempts(id: number): Promise<void>;
  consume(id: number): Promise<void>;
}
