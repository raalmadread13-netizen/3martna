import { DomainError, invariant } from '../DomainError';

/** Immutable money value object. Amounts are kept at 2 decimal places. */
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  static of(amount: number, currency = 'JOD'): Money {
    invariant(Number.isFinite(amount), 'MONEY_INVALID', 'Amount must be a finite number');
    invariant(/^[A-Z]{3}$/.test(currency), 'MONEY_CURRENCY', 'Currency must be an ISO 4217 code');
    return new Money(Math.round(amount * 100) / 100, currency);
  }

  static zero(currency = 'JOD'): Money {
    return new Money(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError('MONEY_CURRENCY_MISMATCH', `${this.currency} != ${other.currency}`);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount - other.amount, this.currency);
  }

  isPositive(): boolean {
    return this.amount > 0;
  }
  isNegative(): boolean {
    return this.amount < 0;
  }
  isZero(): boolean {
    return this.amount === 0;
  }

  gte(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }
}
