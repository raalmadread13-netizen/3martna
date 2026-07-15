import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getContainer } from '@presentation/http/container';
import { actorFrom, pageFrom } from './property.helpers';

const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const apartmentsController = {
  create: handle(async (req, res) => {
    const apartment = await getContainer().createApartment.execute(actorFrom(req), req.body);
    res.status(201).json({ success: true, data: apartment });
  }),

  list: handle(async (req, res) => {
    const buildingId =
      typeof req.query.buildingId === 'string' && req.query.buildingId
        ? req.query.buildingId
        : undefined;
    const result = await getContainer().listApartments.execute(
      actorFrom(req),
      pageFrom(req),
      buildingId,
    );
    res.json({ success: true, ...result });
  }),

  get: handle(async (req, res) => {
    const apartment = await getContainer().getApartment.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: apartment });
  }),

  update: handle(async (req, res) => {
    const apartment = await getContainer().updateApartment.execute(
      actorFrom(req),
      req.params.id,
      req.body,
    );
    res.json({ success: true, data: apartment });
  }),

  archive: handle(async (req, res) => {
    await getContainer().archiveApartment.execute(actorFrom(req), req.params.id);
    res.json({ success: true, message: 'Apartment archived' });
  }),
};
