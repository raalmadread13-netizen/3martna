/**
 * Client-side Idempotency-Key generator. Keys only need to be unique per
 * submission attempt (the server scopes them to caller + endpoint), so a
 * time + randomness composite is sufficient — no crypto required.
 */
export const newIdempotencyKey = (): string =>
  `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
