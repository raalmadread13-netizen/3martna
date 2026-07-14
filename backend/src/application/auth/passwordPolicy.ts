/**
 * Password policy — enforced on register, change and reset.
 * Kept as a pure function so it is trivially unit-testable and can be
 * mirrored client-side for instant feedback.
 */
export interface PasswordPolicyResult {
  valid: boolean;
  failures: string[];
}

const RULES: Array<{ test: (password: string) => boolean; message: string }> = [
  { test: (p) => p.length >= 8, message: 'must be at least 8 characters' },
  { test: (p) => p.length <= 128, message: 'must be at most 128 characters' },
  { test: (p) => /[a-z]/.test(p), message: 'must contain a lowercase letter' },
  { test: (p) => /[A-Z]/.test(p), message: 'must contain an uppercase letter' },
  { test: (p) => /[0-9]/.test(p), message: 'must contain a digit' },
];

export const checkPasswordPolicy = (password: string): PasswordPolicyResult => {
  const failures = RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
  return { valid: failures.length === 0, failures };
};
