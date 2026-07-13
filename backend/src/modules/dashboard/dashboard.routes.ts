import { Request, Response, Router } from 'express';
import { execProc } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';

export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate);

/**
 * @openapi
 * /dashboard/owner:
 *   get:
 *     tags: [Dashboard]
 *     summary: Building-owner dashboard (KPIs, trend, occupancy)
 *     responses:
 *       200: { description: Dashboard payload }
 */
dashboardRoutes.get(
  '/owner',
  authorize('BuildingOwner', 'Accountant'),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Dashboard_Owner', {
      OwnerUserId: req.user!.userId,
    });
    res.json({
      success: true,
      data: {
        kpis: recordsets[0]?.[0] ?? {},
        trend: recordsets[1] ?? [],
        occupancy: recordsets[2] ?? [],
      },
    });
  }),
);

dashboardRoutes.get(
  '/tenant',
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Dashboard_Tenant', { UserId: req.user!.userId });
    res.json({
      success: true,
      data: {
        residence: recordsets[0]?.[0] ?? null,
        summary: recordsets[1]?.[0] ?? {},
        upcomingInvoices: recordsets[2] ?? [],
      },
    });
  }),
);

dashboardRoutes.get(
  '/staff',
  authorize('MaintenanceEmployee', 'CleaningStaff', 'SecurityGuard'),
  catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Dashboard_Staff', { UserId: req.user!.userId });
    res.json({
      success: true,
      data: {
        kpis: recordsets[0]?.[0] ?? {},
        activeTasks: recordsets[1] ?? [],
        todaySchedule: recordsets[2] ?? [],
      },
    });
  }),
);

dashboardRoutes.get(
  '/admin',
  authorize('SystemAdmin'),
  catchAsync(async (_req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Dashboard_Admin');
    res.json({
      success: true,
      data: {
        kpis: recordsets[0]?.[0] ?? {},
        revenueTrend: recordsets[1] ?? [],
        usersByRole: recordsets[2] ?? [],
      },
    });
  }),
);
