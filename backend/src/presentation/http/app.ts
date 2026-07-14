import compression from 'compression';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { apiLimiter } from '@presentation/http/middleware/rateLimiter';
import { errorHandler, notFoundHandler } from '@presentation/http/middleware/errorHandler';
import { requestLogger } from '@presentation/http/middleware/requestLogger';
import { apiRouter } from '@presentation/http/routes';
import { healthRoutes } from '@presentation/http/routes/health.routes';
import { swaggerSpec } from '@presentation/http/swagger';
import { env } from '@shared/config/env';

export const createApp = (): Application => {
  const app = express();

  // Behind reverse proxies in production — correct req.ip for rate limiting
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /* Security */
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Native mobile apps send no Origin; browsers must match the allowlist
        if (!origin || env.corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  /* Parsing & performance */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(compression());
  app.use(requestLogger);

  /* Health (unversioned, for load balancers) */
  app.use('/health', healthRoutes);

  /* API docs */
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { customSiteTitle: '3martna API' }),
  );
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  /* Versioned API (feature routers mount in later sprints) */
  app.use(env.apiPrefix, apiLimiter, apiRouter);

  /* Errors — always last */
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
