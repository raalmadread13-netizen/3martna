import { getFirebase } from '@infrastructure/firebase';
import { closePool, getPool, isDatabaseConfigured } from '@infrastructure/database/connection';
import { logger } from '@infrastructure/logging/logger';
import { env } from '@shared/config/env';
import { createApp } from './app';

const start = async (): Promise<void> => {
  try {
    if (isDatabaseConfigured()) {
      await getPool();
    } else {
      logger.warn('DB_HOST empty — starting without a database connection');
    }
    getFirebase();

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info(`3martna API listening on :${env.port} (${env.nodeEnv})`);
      logger.info('Health:  GET /health   ·   Docs:  GET /api/docs');
    });

    const shutdown = (signal: string): void => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        void closePool().then(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
};

void start();
