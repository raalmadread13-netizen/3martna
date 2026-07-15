import { DateRange } from '@domain/common/values/DateRange';
import { DomainError } from '@domain/common/DomainError';
import { Money } from '@domain/common/values/Money';

describe('Money value object', () => {
  it('rounds to 2 decimal places and formats', () => {
    expect(Money.of(10.005).amount).toBe(10.01);
    expect(Money.of(5, 'JOD').toString()).toBe('5.00 JOD');
  });

  it('adds and subtracts within the same currency', () => {
    expect(Money.of(10).add(Money.of(2.5)).amount).toBe(12.5);
    expect(Money.of(10).subtract(Money.of(3)).amount).toBe(7);
  });

  it('refuses cross-currency arithmetic', () => {
    expect(() => Money.of(10, 'JOD').add(Money.of(1, 'USD'))).toThrow(DomainError);
  });

  it('rejects invalid currency codes and amounts', () => {
    expect(() => Money.of(10, 'jod')).toThrow(DomainError);
    expect(() => Money.of(Number.NaN)).toThrow(DomainError);
  });
});

describe('DateRange value object', () => {
  const start = new Date('2026-01-01');
  const end = new Date('2026-12-31');

  it('requires end after start', () => {
    expect(() => DateRange.of(end, start)).toThrow(DomainError);
  });

  it('tests containment (half-open) and overlap', () => {
    const range = DateRange.of(start, end);
    expect(range.contains(new Date('2026-06-01'))).toBe(true);
    expect(range.contains(end)).toBe(false); // end is exclusive
    expect(range.overlaps(DateRange.of(new Date('2026-12-01'), new Date('2027-02-01')))).toBe(true);
    expect(range.overlaps(DateRange.of(new Date('2027-01-01'), new Date('2027-06-01')))).toBe(
      false,
    );
  });
});
