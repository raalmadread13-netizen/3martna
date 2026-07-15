import { IClock } from '@domain/common/time/IClock';

/**
 * Deterministic clock for tests (ADR-0007). Time only moves when the test
 * advances it, so time-dependent domain behaviour is fully reproducible.
 */
export class FakeClock implements IClock {
  private current: Date;

  constructor(start: Date = new Date('2026-01-01T00:00:00.000Z')) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  /** Move the clock forward by a number of milliseconds. */
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  /** Jump to an explicit instant. */
  set(at: Date): void {
    this.current = new Date(at);
  }
}
