import { Request, Response } from 'express';
import { execProc } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';
import { assertBuildingAccess } from '../buildings/buildings.controller';

const shapeApartment = (recordsets: Record<string, unknown>[][]) => {
  const apartment = recordsets[0]?.[0];
  if (!apartment) throw ApiError.notFound('Apartment not found');
  return {
    ...apartment,
    parkingSpots: recordsets[1] ?? [],
    storageRooms: recordsets[2] ?? [],
    utilityMeters: recordsets[3] ?? [],
    residents: recordsets[4] ?? [],
  };
};

export const apartmentsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    await assertBuildingAccess(req.body.buildingId, req);
    const { recordsets } = await execProc('sp_Apartment_Create', {
      BuildingId: req.body.buildingId,
      FloorId: req.body.floorId,
      ApartmentNumber: req.body.apartmentNumber,
      Bedrooms: req.body.bedrooms ?? 1,
      Bathrooms: req.body.bathrooms ?? 1,
      AreaSqm: req.body.areaSqm ?? null,
      RentAmount: req.body.rentAmount ?? null,
      OwnerUserId: req.body.ownerUserId ?? null,
      Description: req.body.description ?? null,
    });
    res.status(201).json({ success: true, data: shapeApartment(recordsets) });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Apartment_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      BuildingId: req.query.buildingId ?? null,
      Status: req.query.status ?? null,
      Search: req.query.search ?? null,
      OwnerUserId: req.query.ownerUserId ?? null,
      MinRent: req.query.minRent ?? null,
      MaxRent: req.query.maxRent ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Apartment_GetById', {
      ApartmentId: Number(req.params.id),
    });
    res.json({ success: true, data: shapeApartment(recordsets) });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Apartment_Update', {
      ApartmentId: Number(req.params.id),
      Bedrooms: req.body.bedrooms ?? null,
      Bathrooms: req.body.bathrooms ?? null,
      AreaSqm: req.body.areaSqm ?? null,
      RentAmount: req.body.rentAmount ?? null,
      Status: req.body.status ?? null,
      OwnerUserId: req.body.ownerUserId ?? null,
      Description: req.body.description ?? null,
    });
    res.json({ success: true, data: shapeApartment(recordsets) });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_Apartment_Delete', { ApartmentId: Number(req.params.id) });
    res.json({ success: true, message: 'Apartment deleted' });
  }),

  upsertMeter: catchAsync(async (req: Request, res: Response) => {
    await execProc('sp_UtilityMeter_Upsert', {
      ApartmentId: Number(req.params.id),
      MeterType: req.body.meterType,
      MeterNumber: req.body.meterNumber,
      LastReading: req.body.lastReading ?? null,
      LastReadingDate: req.body.lastReadingDate ?? null,
    });
    res.json({ success: true, message: 'Meter saved' });
  }),
};
