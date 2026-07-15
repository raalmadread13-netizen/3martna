/**
 * Raised when a business invariant is violated inside the domain.
 * Framework-independent — the presentation layer maps it to HTTP 422.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const invariant = (condition: unknown, code: string, message: string): void => {
  if (!condition) throw new DomainError(code, message);
};
