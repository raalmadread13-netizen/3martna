import { Occupancy, OccupancyProps } from '@domain/business/Occupancy';
import {
  IOccupancyRepository,
  OccupancyListQuery,
} from '@domain/repositories/business/occupancy.repositories';
import { execQuery } from '@infrastructure/database/connection';
import { CursorResult, PageRequest, PageResult, decodeCursor, encodeCursor } from '@shared/types';

interface OccupancyRow {
  Id: string;
  TenantId: string;
  ApartmentId: string;
  ResidentId: string;
  LeaseContractId: string;
  MoveInDate: Date;
  MoveOutDate: Date | null;
  MoveOutReason: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

const COLUMNS = `Id, TenantId, ApartmentId, ResidentId, LeaseContractId, MoveInDate, MoveOutDate,
  MoveOutReason, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted, RowVersion`;

const toProps = (row: OccupancyRow): OccupancyProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  apartmentId: row.ApartmentId,
  residentId: row.ResidentId,
  leaseContractId: row.LeaseContractId,
  moveInDate: row.MoveInDate,
  moveOutDate: row.MoveOutDate,
  moveOutReason: row.MoveOutReason,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: row.RowVersion ? Buffer.from(row.RowVersion).toString('base64') : null,
});

/** sortBy whitelist → SQL column (never interpolate user input directly). */
const SORT_COLUMNS: Record<OccupancyListQuery['sortBy'], string> = {
  moveInDate: 'MoveInDate',
  createdAt: 'CreatedAt',
};

export class SqlOccupancyRepository implements IOccupancyRepository {
  async findById(tenantId: string, id: string): Promise<Occupancy | null> {
    const rows = await execQuery<OccupancyRow>(
      `SELECT ${COLUMNS} FROM dbo.Occupancies
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    return rows[0] ? Occupancy.restore(toProps(rows[0])) : null;
  }

  async findActiveByApartment(tenantId: string, apartmentId: string): Promise<Occupancy | null> {
    const rows = await execQuery<OccupancyRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.Occupancies
       WHERE TenantId = @tenantId AND ApartmentId = @apartmentId
         AND MoveOutDate IS NULL AND IsDeleted = 0`,
      { tenantId, apartmentId },
    );
    return rows[0] ? Occupancy.restore(toProps(rows[0])) : null;
  }

  async findActiveByResident(tenantId: string, residentId: string): Promise<Occupancy | null> {
    const rows = await execQuery<OccupancyRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.Occupancies
       WHERE TenantId = @tenantId AND ResidentId = @residentId
         AND MoveOutDate IS NULL AND IsDeleted = 0`,
      { tenantId, residentId },
    );
    return rows[0] ? Occupancy.restore(toProps(rows[0])) : null;
  }

  async findActiveByLease(tenantId: string, leaseContractId: string): Promise<Occupancy | null> {
    const rows = await execQuery<OccupancyRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.Occupancies
       WHERE TenantId = @tenantId AND LeaseContractId = @leaseContractId
         AND MoveOutDate IS NULL AND IsDeleted = 0`,
      { tenantId, leaseContractId },
    );
    return rows[0] ? Occupancy.restore(toProps(rows[0])) : null;
  }

  async listCursor(tenantId: string, query: OccupancyListQuery): Promise<CursorResult<Occupancy>> {
    const sortColumn = SORT_COLUMNS[query.sortBy];
    const direction = query.sortDir === 'desc' ? 'DESC' : 'ASC';
    const comparator = query.sortDir === 'desc' ? '<' : '>';
    const position = decodeCursor(query.cursor);

    const filters: string[] = [];
    const params: Record<string, unknown> = { tenantId, limitPlusOne: query.limit + 1 };
    if (query.apartmentId) {
      filters.push('ApartmentId = @apartmentId');
      params.apartmentId = query.apartmentId;
    }
    if (query.residentId) {
      filters.push('ResidentId = @residentId');
      params.residentId = query.residentId;
    }
    if (query.leaseId) {
      filters.push('LeaseContractId = @leaseId');
      params.leaseId = query.leaseId;
    }
    if (query.active === true) filters.push('MoveOutDate IS NULL');
    if (query.active === false) filters.push('MoveOutDate IS NOT NULL');
    if (position) {
      filters.push(
        `(${sortColumn} ${comparator} @cursorKey OR (${sortColumn} = @cursorKey AND Id > @cursorId))`,
      );
      params.cursorKey = new Date(String(position.k));
      params.cursorId = position.id;
    }

    const rows = await execQuery<OccupancyRow>(
      `SELECT ${COLUMNS} FROM dbo.Occupancies
       WHERE TenantId = @tenantId AND IsDeleted = 0
         ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
       ORDER BY ${sortColumn} ${direction}, Id ASC
       OFFSET 0 ROWS FETCH NEXT @limitPlusOne ROWS ONLY`,
      params,
    );

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      data: page.map((row) => Occupancy.restore(toProps(row))),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({
              k:
                query.sortBy === 'moveInDate'
                  ? last.MoveInDate.toISOString()
                  : last.CreatedAt.toISOString(),
              id: last.Id,
            })
          : null,
      limit: query.limit,
    };
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Occupancy>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.Occupancies WHERE TenantId = @tenantId AND IsDeleted = 0`,
      { tenantId },
    );
    const rows = await execQuery<OccupancyRow>(
      `SELECT ${COLUMNS} FROM dbo.Occupancies
       WHERE TenantId = @tenantId AND IsDeleted = 0
       ORDER BY MoveInDate DESC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { tenantId, offset: (page.page - 1) * page.pageSize, pageSize: page.pageSize },
    );
    return {
      data: rows.map((row) => Occupancy.restore(toProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async save(occupancy: Occupancy): Promise<void> {
    const p = occupancy.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.Occupancies WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.Occupancies SET
           MoveOutDate = @moveOutDate, MoveOutReason = @moveOutReason,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.Occupancies
           (Id, TenantId, ApartmentId, ResidentId, LeaseContractId, MoveInDate, MoveOutDate,
            MoveOutReason, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted)
         VALUES
           (@id, @tenantId, @apartmentId, @residentId, @leaseContractId, @moveInDate,
            @moveOutDate, @moveOutReason, @createdAt, @updatedAt, @createdBy, @updatedBy,
            @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        apartmentId: p.apartmentId,
        residentId: p.residentId,
        leaseContractId: p.leaseContractId,
        moveInDate: p.moveInDate,
        moveOutDate: p.moveOutDate,
        moveOutReason: p.moveOutReason,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
  }

  async remove(occupancy: Occupancy): Promise<void> {
    const p = occupancy.toProps();
    await execQuery(
      `UPDATE dbo.Occupancies
       SET IsDeleted = 1, UpdatedAt = @updatedAt, UpdatedBy = @updatedBy
       WHERE Id = @id AND TenantId = @tenantId`,
      { id: p.id, tenantId: p.tenantId, updatedAt: p.updatedAt, updatedBy: p.updatedBy },
    );
  }
}
