import { Router } from 'express';
import { apartmentsRoutes } from './apartments.routes';
import { authRoutes } from './auth.routes';
import { buildingsRoutes } from './buildings.routes';
import { leasesRoutes } from './leases.routes';
import { occupancyRoutes } from './occupancy.routes';
import { ownersRoutes } from './owners.routes';
import { residentsRoutes } from './residents.routes';

/** Versioned API router. Feature routers mount here sprint by sprint. */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/buildings', buildingsRoutes);
apiRouter.use('/apartments', apartmentsRoutes);
apiRouter.use('/owners', ownersRoutes);
apiRouter.use('/residents', residentsRoutes);
apiRouter.use('/leases', leasesRoutes);
apiRouter.use('/occupancy', occupancyRoutes);
