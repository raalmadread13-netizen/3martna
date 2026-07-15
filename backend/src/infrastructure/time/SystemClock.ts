import { IClock } from '@domain/common/time/IClock';

/** Production clock — the single place the real wall clock is read. */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export const systemClock = new SystemClock();
