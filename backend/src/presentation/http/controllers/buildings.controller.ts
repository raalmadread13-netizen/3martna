import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getContainer } from '@presentation/http/container';
import { actorFrom, pageFrom } from './property.helpers';

const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const buildingsController = {
  create: handle(async (req, res) => {
    const building = await getContainer().createBuilding.execute(actorFrom(req), req.body);
    res.status(201).json({ success: true, data: building });
  }),

  list: handle(async (req, res) => {
    const result = await getContainer().listBuildings.execute(actorFrom(req), pageFrom(req));
    res.json({ success: true, ...result });
  }),

  get: handle(async (req, res) => {
    const building = await getContainer().getBuilding.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: building });
  }),

  update: handle(async (req, res) => {
    const building = await getContainer().updateBuilding.execute(
      actorFrom(req),
      req.params.id,
      req.body,
    );
    res.json({ success: true, data: building });
  }),

  archive: handle(async (req, res) => {
    await getContainer().archiveBuilding.execute(actorFrom(req), req.params.id);
    res.json({ success: true, message: 'Building archived' });
  }),

  /* ------------------------- floors ------------------------- */

  listFloors: handle(async (req, res) => {
    const floors = await getContainer().listFloors.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: floors });
  }),

  addFloor: handle(async (req, res) => {
    const floor = await getContainer().addFloor.execute(actorFrom(req), req.params.id, req.body);
    res.status(201).json({ success: true, data: floor });
  }),

  updateFloor: handle(async (req, res) => {
    const floor = await getContainer().updateFloor.execute(
      actorFrom(req),
      req.params.id,
      req.params.floorId,
      { name: req.body.name || null },
    );
    res.json({ success: true, data: floor });
  }),
};
