import { createApp } from './app';
import { closePool, getPool } from './config/db';
import { env } from './config/env';
import { getFirebase } from './config/firebase';
import { logger } from './config/logger';
import { startJobs } from './jobs/scheduler';

const start = async (): Promise<void> => {
  try {
    await getPool();
    getFirebase();

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info(`3martna API listening on :${env.port} (${env.nodeEnv})`);
      logger.info(`Swagger docs at /api/docs`);
    });

    if (env.enableJobs) startJobs();

    const shutdown = (signal: string): void => {
      logger.info(`${signal} received — shutting down`);
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
      // Force-exit if connections refuse to drain
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
