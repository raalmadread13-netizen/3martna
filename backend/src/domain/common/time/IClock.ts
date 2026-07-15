/**
 * Time abstraction (ADR-0007). The domain and application never read the
 * wall clock directly — they receive an `IClock`, so "now" is injectable
 * and deterministic in tests (FakeClock).
 */
export interface IClock {
  /** Current instant in UTC. */
  now(): Date;
}
