import { Request, Response } from 'express';
import { execProc, execProcOne } from '../../config/db';
import { isAdmin } from '../../middleware/auth';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getPagination, paginate } from '../../utils/pagination';

/** Owners/staff may only touch buildings they are linked to. */
export const assertBuildingAccess = async (buildingId: number, req: Request): Promise<void> => {
  if (isAdmin(req)) return;
  const row = await execProcOne<{ HasAccess: number }>('sp_Building_CheckAccess', {
    BuildingId: buildingId,
    UserId: req.user!.userId,
  });
  if (!row?.HasAccess) throw ApiError.forbidden('No access to this building');
};

export const buildingsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const { recordsets } = await execProc('sp_Building_Create', {
      OwnerUserId: isAdmin(req) && req.body.ownerUserId ? req.body.ownerUserId : req.user!.userId,
      Name: req.body.name,
      NameAr: req.body.nameAr ?? null,
      Address: req.body.address,
      City: req.body.city,
      District: req.body.district ?? null,
      Latitude: req.body.latitude ?? null,
      Longitude: req.body.longitude ?? null,
      TotalFloors: req.body.totalFloors ?? 1,
      YearBuilt: req.body.yearBuilt ?? null,
      ImageUrl: req.body.imageUrl ?? null,
      Notes: req.body.notes ?? null,
    });
    res.status(201).json({ success: true, data: { ...recordsets[0][0], floors: recordsets[1] } });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const pagination = getPagination(req);
    const { recordset } = await execProc('sp_Building_List', {
      Page: pagination.page,
      PageSize: pagination.pageSize,
      Search: req.query.search ?? null,
      // Non-admins only see their own buildings
      OwnerUserId: isAdmin(req) ? req.query.ownerUserId ?? null : req.user!.userId,
      City: req.query.city ?? null,
    });
    res.json({ success: true, ...paginate(recordset, pagination) });
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    const { recordsets } = await execProc('sp_Building_GetById', { BuildingId: buildingId });
    const building = recordsets[0]?.[0];
    if (!building) throw ApiError.notFound('Building not found');
    res.json({ success: true, data: { ...building, floors: recordsets[1] ?? [] } });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    await assertBuildingAccess(buildingId, req);
    const { recordsets } = await execProc('sp_Building_Update', {
      BuildingId: buildingId,
      Name: req.body.name ?? null,
      NameAr: req.body.nameAr ?? null,
      Address: req.body.address ?? null,
      City: req.body.city ?? null,
      District: req.body.district ?? null,
      Latitude: req.body.latitude ?? null,
      Longitude: req.body.longitude ?? null,
      YearBuilt: req.body.yearBuilt ?? null,
      ImageUrl: req.body.imageUrl ?? null,
      Notes: req.body.notes ?? null,
    });
    res.json({ success: true, data: { ...recordsets[0][0], floors: recordsets[1] ?? [] } });
  }),

  deactivate: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    await assertBuildingAccess(buildingId, req);
    await execProc('sp_Building_Deactivate', { BuildingId: buildingId });
    res.json({ success: true, message: 'Building deactivated' });
  }),

  /* ---- parking ---- */
  listParking: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    await assertBuildingAccess(buildingId, req);
    const { recordset } = await execProc('sp_ParkingSpot_List', { BuildingId: buildingId });
    res.json({ success: true, data: recordset });
  }),

  upsertParking: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    await assertBuildingAccess(buildingId, req);
    const spot = await execProcOne('sp_ParkingSpot_Upsert', {
      ParkingSpotId: req.body.parkingSpotId ?? null,
      BuildingId: buildingId,
      SpotNumber: req.body.spotNumber,
      ApartmentId: req.body.apartmentId ?? null,
      SpotType: req.body.spotType ?? 'Standard',
      MonthlyFee: req.body.monthlyFee ?? null,
    });
    res.status(req.body.parkingSpotId ? 200 : 201).json({ success: true, data: spot });
  }),

  deleteParking: catchAsync(async (req: Request, res: Response) => {
    await assertBuildingAccess(Number(req.params.id), req);
    await execProc('sp_ParkingSpot_Delete', { ParkingSpotId: Number(req.params.spotId) });
    res.json({ success: true, message: 'Parking spot removed' });
  }),

  /* ---- storage rooms ---- */
  listStorage: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    await assertBuildingAccess(buildingId, req);
    const { recordset } = await execProc('sp_StorageRoom_List', { BuildingId: buildingId });
    res.json({ success: true, data: recordset });
  }),

  upsertStorage: catchAsync(async (req: Request, res: Response) => {
    const buildingId = Number(req.params.id);
    await assertBuildingAccess(buildingId, req);
    const room = await execProcOne('sp_StorageRoom_Upsert', {
      StorageRoomId: req.body.storageRoomId ?? null,
      BuildingId: buildingId,
      RoomNumber: req.body.roomNumber,
      ApartmentId: req.body.apartmentId ?? null,
      AreaSqm: req.body.areaSqm ?? null,
      MonthlyFee: req.body.monthlyFee ?? null,
    });
    res.status(req.body.storageRoomId ? 200 : 201).json({ success: true, data: room });
  }),

  deleteStorage: catchAsync(async (req: Request, res: Response) => {
    await assertBuildingAccess(Number(req.params.id), req);
    await execProc('sp_StorageRoom_Delete', { StorageRoomId: Number(req.params.roomId) });
    res.json({ success: true, message: 'Storage room removed' });
  }),
};
