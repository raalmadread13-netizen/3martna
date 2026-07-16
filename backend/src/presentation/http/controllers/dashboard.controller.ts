import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getContainer } from '@presentation/http/container';
import { actorFrom } from './property.helpers';

const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/** Thin HTTP translation — every statistic is computed in the report services. */
export const dashboardController = {
  summary: handle(async (req, res) => {
    const summary = await getContainer().getDashboardSummary.execute(actorFrom(req));
    res.json({ success: true, data: summary });
  }),

  buildings: handle(async (req, res) => {
    const summaries = await getContainer().getBuildingSummaries.execute(actorFrom(req));
    res.json({ success: true, data: summaries });
  }),

  leaseAlerts: handle(async (req, res) => {
    const alerts = await getContainer().getLeaseAlerts.execute(actorFrom(req));
    res.json({ success: true, data: alerts });
  }),

  activity: handle(async (req, res) => {
    const activity = await getContainer().getRecentActivity.execute(
      actorFrom(req),
      Number(req.query.limit ?? 15),
    );
    res.json({ success: true, data: activity });
  }),
};
