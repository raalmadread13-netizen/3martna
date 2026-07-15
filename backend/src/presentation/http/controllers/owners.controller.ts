import { NextFunction, Request, RequestHandler, Response } from 'express';
import { getContainer } from '@presentation/http/container';
import { actorFrom, pageFrom } from './property.helpers';

const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const ownersController = {
  create: handle(async (req, res) => {
    const owner = await getContainer().createOwner.execute(actorFrom(req), req.body);
    res.status(201).json({ success: true, data: owner });
  }),

  list: handle(async (req, res) => {
    const result = await getContainer().listOwners.execute(actorFrom(req), pageFrom(req));
    res.json({ success: true, ...result });
  }),

  get: handle(async (req, res) => {
    const owner = await getContainer().getOwner.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: owner });
  }),

  update: handle(async (req, res) => {
    const owner = await getContainer().updateOwner.execute(actorFrom(req), req.params.id, req.body);
    res.json({ success: true, data: owner });
  }),
};
