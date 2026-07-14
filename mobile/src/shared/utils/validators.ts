/** Client-side validators — mirror the backend policy for instant feedback. */

export const isRequired = (value: string): string | undefined =>
  value.trim().length === 0 ? 'This field is required' : undefined;

export const isEmail = (value: string): string | undefined =>
  value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Invalid email address' : undefined;

export const isPhone = (value: string): string | undefined =>
  /^\+?[0-9]{9,15}$/.test(value.trim()) ? undefined : 'Invalid phone number (e.g. +9627XXXXXXXX)';

/** Mirrors backend passwordPolicy: 8+ chars, lower, upper, digit. */
export const isStrongPassword = (value: string): string | undefined => {
  if (value.length < 8) return 'At least 8 characters';
  if (!/[a-z]/.test(value)) return 'Needs a lowercase letter';
  if (!/[A-Z]/.test(value)) return 'Needs an uppercase letter';
  if (!/[0-9]/.test(value)) return 'Needs a digit';
  return undefined;
};

export const matches =
  (other: string, label = 'Passwords') =>
  (value: string): string | undefined =>
    value !== other ? `${label} do not match` : undefined;
