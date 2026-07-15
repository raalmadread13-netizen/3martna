import { Apartment, ApartmentProps, ApartmentStatus } from '@domain/business/Apartment';
import { IApartmentRepository } from '@domain/repositories/business/property.repositories';
import { execQuery } from '@infrastructure/database/connection';
import { PageRequest, PageResult } from '@shared/types';

interface ApartmentRow {
  Id: string;
  TenantId: string;
  BuildingId: string;
  FloorId: string;
  UnitNumber: string;
  Bedrooms: number;
  Bathrooms: number;
  AreaSqm: number | null;
  BaseRentAmount: number | null;
  Currency: string;
  Status: ApartmentStatus;
  OwnerId: string | null;
  Description: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

const COLUMNS = `Id, TenantId, BuildingId, FloorId, UnitNumber, Bedrooms, Bathrooms, AreaSqm,
  BaseRentAmount, Currency, Status, OwnerId, Description, CreatedAt, UpdatedAt, CreatedBy,
  UpdatedBy, IsDeleted, RowVersion`;

const toProps = (row: ApartmentRow): ApartmentProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  buildingId: row.BuildingId,
  floorId: row.FloorId,
  unitNumber: row.UnitNumber,
  bedrooms: row.Bedrooms,
  bathrooms: row.Bathrooms,
  areaSqm: row.AreaSqm === null ? null : Number(row.AreaSqm),
  baseRentAmount: row.BaseRentAmount === null ? null : Number(row.BaseRentAmount),
  currency: row.Currency,
  status: row.Status,
  ownerId: row.OwnerId,
  description: row.Description,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: row.RowVersion ? Buffer.from(row.RowVersion).toString('base64') : null,
});

/**
 * SQL Server implementation of the Apartment aggregate repository.
 * Fully parameterized; tenant-scoped and soft-delete filtered throughout.
 */
export class SqlApartmentRepository implements IApartmentRepository {
  async findById(tenantId: string, id: string): Promise<Apartment | null> {
    const rows = await execQuery<ApartmentRow>(
      `SELECT ${COLUMNS} FROM dbo.Apartments
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    return rows[0] ? Apartment.restore(toProps(rows[0])) : null;
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Apartment>> {
    return this.pageWhere(tenantId, page, '', {});
  }

  async listByBuilding(
    tenantId: string,
    buildingId: string,
    page: PageRequest,
  ): Promise<PageResult<Apartment>> {
    return this.pageWhere(tenantId, page, 'AND BuildingId = @buildingId', { buildingId });
  }

  private async pageWhere(
    tenantId: string,
    page: PageRequest,
    filter: string,
    filterParams: Record<string, unknown>,
  ): Promise<PageResult<Apartment>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.Apartments
       WHERE TenantId = @tenantId AND IsDeleted = 0 ${filter}`,
      { tenantId, ...filterParams },
    );
    const rows = await execQuery<ApartmentRow>(
      `SELECT ${COLUMNS} FROM dbo.Apartments
       WHERE TenantId = @tenantId AND IsDeleted = 0 ${filter}
       ORDER BY UnitNumber
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      {
        tenantId,
        ...filterParams,
        offset: (page.page - 1) * page.pageSize,
        pageSize: page.pageSize,
      },
    );
    return {
      data: rows.map((row) => Apartment.restore(toProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async existsByUnitNumber(
    tenantId: string,
    buildingId: string,
    unitNumber: string,
  ): Promise<boolean> {
    const rows = await execQuery(
      `SELECT 1 AS X FROM dbo.Apartments
       WHERE TenantId = @tenantId AND BuildingId = @buildingId
         AND UnitNumber = @unitNumber AND IsDeleted = 0`,
      { tenantId, buildingId, unitNumber },
    );
    return rows.length > 0;
  }

  async countByStatus(tenantId: string, buildingId: string): Promise<Record<string, number>> {
    const rows = await execQuery<{ Status: string; Cnt: number }>(
      `SELECT Status, COUNT(*) AS Cnt FROM dbo.Apartments
       WHERE TenantId = @tenantId AND BuildingId = @buildingId AND IsDeleted = 0
       GROUP BY Status`,
      { tenantId, buildingId },
    );
    return Object.fromEntries(rows.map((row) => [row.Status, row.Cnt]));
  }

  async save(apartment: Apartment): Promise<void> {
    const p = apartment.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.Apartments WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.Apartments SET
           Bedrooms = @bedrooms, Bathrooms = @bathrooms, AreaSqm = @areaSqm,
           BaseRentAmount = @baseRentAmount, Currency = @currency, Status = @status,
           OwnerId = @ownerId, Description = @description,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.Apartments
           (Id, TenantId, BuildingId, FloorId, UnitNumber, Bedrooms, Bathrooms, AreaSqm,
            BaseRentAmount, Currency, Status, OwnerId, Description, CreatedAt, UpdatedAt,
            CreatedBy, UpdatedBy, IsDeleted)
         VALUES
           (@id, @tenantId, @buildingId, @floorId, @unitNumber, @bedrooms, @bathrooms, @areaSqm,
            @baseRentAmount, @currency, @status, @ownerId, @description, @createdAt, @updatedAt,
            @createdBy, @updatedBy, @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        buildingId: p.buildingId,
        floorId: p.floorId,
        unitNumber: p.unitNumber,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        areaSqm: p.areaSqm,
        baseRentAmount: p.baseRentAmount,
        currency: p.currency,
        status: p.status,
        ownerId: p.ownerId,
        description: p.description,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
  }

  async remove(apartment: Apartment): Promise<void> {
    const p = apartment.toProps();
    await execQuery(
      `UPDATE dbo.Apartments
       SET IsDeleted = 1, UpdatedAt = @updatedAt, UpdatedBy = @updatedBy
       WHERE Id = @id AND TenantId = @tenantId`,
      { id: p.id, tenantId: p.tenantId, updatedAt: p.updatedAt, updatedBy: p.updatedBy },
    );
  }
}
