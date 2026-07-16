import { NextFunction, Request, RequestHandler, Response } from 'express';
import { LeaseListQuery } from '@domain/repositories/business/leasing.repositories';
import { OccupancyListQuery } from '@domain/repositories/business/occupancy.repositories';
import { ResidentListQuery } from '@domain/repositories/business/property.repositories';
import { getContainer } from '@presentation/http/container';
import { SortDirection } from '@shared/types';
import { actorFrom } from './property.helpers';

const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/* Query values below were validated, defaulted and coerced by Joi. */
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const cursorBase = (
  req: Request,
): { cursor?: string; limit: number; sortDir: SortDirection; search?: string } => ({
  cursor: str(req.query.cursor),
  limit: Number(req.query.limit ?? 20),
  sortDir: (str(req.query.sortDir) ?? 'asc') as SortDirection,
  search: str(req.query.search),
});

export const residentsController = {
  create: handle(async (req, res) => {
    const resident = await getContainer().registerResident.execute(actorFrom(req), req.body);
    res.status(201).json({ success: true, data: resident });
  }),

  list: handle(async (req, res) => {
    const query: ResidentListQuery = {
      ...cursorBase(req),
      sortBy: (str(req.query.sortBy) ?? 'fullName') as ResidentListQuery['sortBy'],
      status: str(req.query.status) as ResidentListQuery['status'],
      apartmentId: str(req.query.apartmentId),
    };
    const result = await getContainer().listResidents.execute(actorFrom(req), query);
    res.json({ success: true, ...result });
  }),

  get: handle(async (req, res) => {
    const resident = await getContainer().getResident.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: resident });
  }),

  update: handle(async (req, res) => {
    const resident = await getContainer().updateResident.execute(
      actorFrom(req),
      req.params.id,
      req.body,
    );
    res.json({ success: true, data: resident });
  }),
};

export const leasesController = {
  create: handle(async (req, res) => {
    const lease = await getContainer().createLease.execute(actorFrom(req), req.body);
    res.status(201).json({ success: true, data: lease });
  }),

  list: handle(async (req, res) => {
    const query: LeaseListQuery = {
      ...cursorBase(req),
      sortBy: (str(req.query.sortBy) ?? 'startDate') as LeaseListQuery['sortBy'],
      sortDir: (str(req.query.sortDir) ?? 'desc') as SortDirection,
      status: str(req.query.status),
      apartmentId: str(req.query.apartmentId),
      residentId: str(req.query.residentId),
    };
    const result = await getContainer().listLeases.execute(actorFrom(req), query);
    res.json({ success: true, ...result });
  }),

  get: handle(async (req, res) => {
    const lease = await getContainer().getLease.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: lease });
  }),

  update: handle(async (req, res) => {
    const lease = await getContainer().updateLease.execute(actorFrom(req), req.params.id, req.body);
    res.json({ success: true, data: lease });
  }),

  terminate: handle(async (req, res) => {
    const lease = await getContainer().terminateLease.execute(
      actorFrom(req),
      req.params.id,
      req.body,
    );
    res.json({ success: true, data: lease });
  }),
};

export const occupancyController = {
  moveIn: handle(async (req, res) => {
    const occupancy = await getContainer().moveIn.execute(actorFrom(req), req.body);
    res.status(201).json({ success: true, data: occupancy });
  }),

  moveOut: handle(async (req, res) => {
    const occupancy = await getContainer().moveOut.execute(actorFrom(req), req.params.id, req.body);
    res.json({ success: true, data: occupancy });
  }),

  get: handle(async (req, res) => {
    const occupancy = await getContainer().getOccupancy.execute(actorFrom(req), req.params.id);
    res.json({ success: true, data: occupancy });
  }),

  list: handle(async (req, res) => {
    const query: OccupancyListQuery = {
      cursor: str(req.query.cursor),
      limit: Number(req.query.limit ?? 20),
      sortBy: (str(req.query.sortBy) ?? 'moveInDate') as OccupancyListQuery['sortBy'],
      sortDir: (str(req.query.sortDir) ?? 'desc') as SortDirection,
      apartmentId: str(req.query.apartmentId),
      residentId: str(req.query.residentId),
      leaseId: str(req.query.leaseId),
      active: req.query.active === undefined ? undefined : String(req.query.active) === 'true',
    };
    const result = await getContainer().listOccupancyHistory.execute(actorFrom(req), query);
    res.json({ success: true, ...result });
  }),
};
