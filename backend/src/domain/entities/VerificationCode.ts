export type VerificationPurpose = 'EmailVerify' | 'PhoneVerify' | 'PasswordReset';

export interface VerificationCode {
  id: string;
  userId: string;
  /** SHA-256 hex of the code/token — never stored in plain form. */
  codeHash: string;
  purpose: VerificationPurpose;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
}

export interface NewVerificationCode {
  userId: string;
  codeHash: string;
  purpose: VerificationPurpose;
  expiresAt: Date;
}
