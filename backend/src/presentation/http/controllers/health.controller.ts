import { Request, Response } from 'express';
import { GetHealthStatus } from '@application/use-cases/GetHealthStatus';
import { isDatabaseConfigured } from '@infrastructure/database/connection';
import { systemClock } from '@infrastructure/time/SystemClock';
import { env } from '@shared/config/env';

const getHealthStatus = new GetHealthStatus(systemClock);

export const healthController = {
  /** GET /health — liveness probe. */
  check(_req: Request, res: Response): void {
    res.json(getHealthStatus.execute());
  },

  /** GET /health/details — readiness diagnostics. */
  details(_req: Request, res: Response): void {
    res.json(getHealthStatus.executeDetailed(env.nodeEnv, isDatabaseConfigured()));
  },
};
