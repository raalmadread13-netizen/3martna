import { Router } from 'express';
import { apartmentsRoutes } from './apartments.routes';
import { authRoutes } from './auth.routes';
import { buildingsRoutes } from './buildings.routes';
import { ownersRoutes } from './owners.routes';

/** Versioned API router. Feature routers mount here sprint by sprint. */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/buildings', buildingsRoutes);
apiRouter.use('/apartments', apartmentsRoutes);
apiRouter.use('/owners', ownersRoutes);
