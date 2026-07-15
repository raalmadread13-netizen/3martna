import {
  NewVerificationCode,
  VerificationCode,
  VerificationPurpose,
} from '@domain/entities/VerificationCode';

export interface IVerificationCodeRepository {
  /** Invalidate previous active codes of the same purpose, then insert. */
  createReplacingActive(code: NewVerificationCode): Promise<void>;
  /** Latest unconsumed, unexpired code for a user + purpose. */
  findActive(userId: string, purpose: VerificationPurpose): Promise<VerificationCode | null>;
  incrementAttempts(id: string): Promise<void>;
  consume(id: string): Promise<void>;
}
