import { Router } from 'express';
import { authRoutes } from './auth.routes';

/**
 * Versioned API router. Feature routers mount here sprint by sprint:
 *
 *   apiRouter.use('/buildings', buildingsRoutes);
 *   ...
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
