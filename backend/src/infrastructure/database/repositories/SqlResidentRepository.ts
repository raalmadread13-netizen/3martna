import { Resident, ResidencyType, ResidentProps } from '@domain/business/Resident';
import {
  IResidentRepository,
  ResidentListQuery,
} from '@domain/repositories/business/property.repositories';
import { execQuery } from '@infrastructure/database/connection';
import { CursorResult, PageRequest, PageResult, decodeCursor, encodeCursor } from '@shared/types';

interface ResidentRow {
  Id: string;
  TenantId: string;
  ApartmentId: string | null;
  UserId: string | null;
  FullName: string;
  PhoneNumber: string;
  Email: string | null;
  ResidencyType: ResidencyType;
  MoveInDate: Date | null;
  MoveOutDate: Date | null;
  EmergencyContactName: string | null;
  EmergencyContactPhone: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

const COLUMNS = `Id, TenantId, ApartmentId, UserId, FullName, PhoneNumber, Email, ResidencyType,
  MoveInDate, MoveOutDate, EmergencyContactName, EmergencyContactPhone, CreatedAt, UpdatedAt,
  CreatedBy, UpdatedBy, IsDeleted, RowVersion`;

const toProps = (row: ResidentRow): ResidentProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  apartmentId: row.ApartmentId,
  userId: row.UserId,
  fullName: row.FullName,
  phoneNumber: row.PhoneNumber,
  email: row.Email,
  residencyType: row.ResidencyType,
  moveInDate: row.MoveInDate,
  moveOutDate: row.MoveOutDate,
  emergencyContactName: row.EmergencyContactName,
  emergencyContactPhone: row.EmergencyContactPhone,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: row.RowVersion ? Buffer.from(row.RowVersion).toString('base64') : null,
});

/** sortBy whitelist → SQL column (never interpolate user input directly). */
const SORT_COLUMNS: Record<ResidentListQuery['sortBy'], string> = {
  fullName: 'FullName',
  createdAt: 'CreatedAt',
};

export class SqlResidentRepository implements IResidentRepository {
  async findById(tenantId: string, id: string): Promise<Resident | null> {
    const rows = await execQuery<ResidentRow>(
      `SELECT ${COLUMNS} FROM dbo.Residents
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    return rows[0] ? Resident.restore(toProps(rows[0])) : null;
  }

  async findByUserId(tenantId: string, userId: string): Promise<Resident | null> {
    const rows = await execQuery<ResidentRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.Residents
       WHERE UserId = @userId AND TenantId = @tenantId AND IsDeleted = 0`,
      { userId, tenantId },
    );
    return rows[0] ? Resident.restore(toProps(rows[0])) : null;
  }

  async listActiveByApartment(tenantId: string, apartmentId: string): Promise<Resident[]> {
    const rows = await execQuery<ResidentRow>(
      `SELECT ${COLUMNS} FROM dbo.Residents
       WHERE TenantId = @tenantId AND ApartmentId = @apartmentId
         AND MoveOutDate IS NULL AND IsDeleted = 0`,
      { tenantId, apartmentId },
    );
    return rows.map((row) => Resident.restore(toProps(row)));
  }

  async listCursor(tenantId: string, query: ResidentListQuery): Promise<CursorResult<Resident>> {
    const sortColumn = SORT_COLUMNS[query.sortBy];
    const direction = query.sortDir === 'desc' ? 'DESC' : 'ASC';
    const comparator = query.sortDir === 'desc' ? '<' : '>';
    const position = decodeCursor(query.cursor);

    const filters: string[] = [];
    const params: Record<string, unknown> = { tenantId, limitPlusOne: query.limit + 1 };
    if (query.search) {
      filters.push('(FullName LIKE @search OR PhoneNumber LIKE @search OR Email LIKE @search)');
      params.search = `%${query.search}%`;
    }
    if (query.apartmentId) {
      filters.push('ApartmentId = @apartmentId');
      params.apartmentId = query.apartmentId;
    }
    if (query.status === 'active') {
      filters.push('ApartmentId IS NOT NULL AND MoveOutDate IS NULL');
    } else if (query.status === 'inactive') {
      filters.push('(ApartmentId IS NULL OR MoveOutDate IS NOT NULL)');
    }
    if (position) {
      filters.push(
        `(${sortColumn} ${comparator} @cursorKey OR (${sortColumn} = @cursorKey AND Id > @cursorId))`,
      );
      params.cursorKey = query.sortBy === 'createdAt' ? new Date(String(position.k)) : position.k;
      params.cursorId = position.id;
    }

    const rows = await execQuery<ResidentRow>(
      `SELECT ${COLUMNS} FROM dbo.Residents
       WHERE TenantId = @tenantId AND IsDeleted = 0
         ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
       ORDER BY ${sortColumn} ${direction}, Id ASC
       OFFSET 0 ROWS FETCH NEXT @limitPlusOne ROWS ONLY`,
      params,
    );

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      data: page.map((row) => Resident.restore(toProps(row))),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({
              k: query.sortBy === 'createdAt' ? last.CreatedAt.toISOString() : last.FullName,
              id: last.Id,
            })
          : null,
      limit: query.limit,
    };
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Resident>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.Residents WHERE TenantId = @tenantId AND IsDeleted = 0`,
      { tenantId },
    );
    const rows = await execQuery<ResidentRow>(
      `SELECT ${COLUMNS} FROM dbo.Residents
       WHERE TenantId = @tenantId AND IsDeleted = 0
       ORDER BY FullName
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { tenantId, offset: (page.page - 1) * page.pageSize, pageSize: page.pageSize },
    );
    return {
      data: rows.map((row) => Resident.restore(toProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async save(resident: Resident): Promise<void> {
    const p = resident.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.Residents WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.Residents SET
           ApartmentId = @apartmentId, UserId = @userId, FullName = @fullName,
           PhoneNumber = @phoneNumber, Email = @email, ResidencyType = @residencyType,
           MoveInDate = @moveInDate, MoveOutDate = @moveOutDate,
           EmergencyContactName = @emergencyContactName,
           EmergencyContactPhone = @emergencyContactPhone,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.Residents
           (Id, TenantId, ApartmentId, UserId, FullName, PhoneNumber, Email, ResidencyType,
            MoveInDate, MoveOutDate, EmergencyContactName, EmergencyContactPhone,
            CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted)
         VALUES
           (@id, @tenantId, @apartmentId, @userId, @fullName, @phoneNumber, @email,
            @residencyType, @moveInDate, @moveOutDate, @emergencyContactName,
            @emergencyContactPhone, @createdAt, @updatedAt, @createdBy, @updatedBy, @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        apartmentId: p.apartmentId,
        userId: p.userId,
        fullName: p.fullName,
        phoneNumber: p.phoneNumber,
        email: p.email,
        residencyType: p.residencyType,
        moveInDate: p.moveInDate,
        moveOutDate: p.moveOutDate,
        emergencyContactName: p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
  }

  async remove(resident: Resident): Promise<void> {
    const p = resident.toProps();
    await execQuery(
      `UPDATE dbo.Residents
       SET IsDeleted = 1, UpdatedAt = @updatedAt, UpdatedBy = @updatedBy
       WHERE Id = @id AND TenantId = @tenantId`,
      { id: p.id, tenantId: p.tenantId, updatedAt: p.updatedAt, updatedBy: p.updatedBy },
    );
  }
}
