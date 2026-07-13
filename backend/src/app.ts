import compression from 'compression';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import { auditTrail } from './middleware/audit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { sanitizeBody } from './middleware/sanitize';
import { apiRouter } from './routes';

export const createApp = (): Application => {
  const app = express();

  // Behind Railway/Render proxies — needed for correct req.ip & rate limiting
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /* Security */
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Mobile apps send no Origin header; browsers must match the allowlist
        if (!origin || env.corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(hpp());

  /* Parsing & performance */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(compression());
  app.use(sanitizeBody);

  /* Request logging */
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path === '/health') return;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  /* Health check (readiness for Railway/Render) */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  /* API docs */
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: '3martna API' }));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  /* API v1 */
  app.use(env.apiPrefix, apiLimiter, auditTrail, apiRouter);

  /* Errors */
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
