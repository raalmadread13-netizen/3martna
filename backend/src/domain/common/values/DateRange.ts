import { invariant } from '../DomainError';

/** Immutable half-open date range [start, end). End must be after start. */
export class DateRange {
  private constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {}

  static of(start: Date, end: Date): DateRange {
    invariant(
      start instanceof Date && !Number.isNaN(start.getTime()),
      'DATERANGE_INVALID',
      'Start date is invalid',
    );
    invariant(
      end instanceof Date && !Number.isNaN(end.getTime()),
      'DATERANGE_INVALID',
      'End date is invalid',
    );
    invariant(end.getTime() > start.getTime(), 'DATERANGE_ORDER', 'End must be after start');
    return new DateRange(start, end);
  }

  contains(date: Date): boolean {
    const time = date.getTime();
    return time >= this.start.getTime() && time < this.end.getTime();
  }

  overlaps(other: DateRange): boolean {
    return this.start.getTime() < other.end.getTime() && other.start.getTime() < this.end.getTime();
  }

  /** Whether the range has fully elapsed as of the given instant (from IClock). */
  isPast(asOf: Date): boolean {
    return this.end.getTime() <= asOf.getTime();
  }

  durationDays(): number {
    return Math.round((this.end.getTime() - this.start.getTime()) / 86_400_000);
  }
}
