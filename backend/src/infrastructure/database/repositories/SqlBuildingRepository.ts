import {
  Building,
  BuildingProps,
  BuildingStatus,
  Floor,
  FloorProps,
} from '@domain/business/Building';
import { IBuildingRepository } from '@domain/repositories/business/property.repositories';
import { execQuery } from '@infrastructure/database/connection';
import { PageRequest, PageResult } from '@shared/types';

interface BuildingRow {
  Id: string;
  TenantId: string;
  Name: string;
  Address: string;
  City: string;
  District: string | null;
  Latitude: number | null;
  Longitude: number | null;
  TotalFloors: number;
  YearBuilt: number | null;
  Status: BuildingStatus;
  Notes: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

interface FloorRow {
  Id: string;
  TenantId: string;
  BuildingId: string;
  FloorNumber: number;
  Name: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

const COLUMNS = `Id, TenantId, Name, Address, City, District, Latitude, Longitude, TotalFloors,
  YearBuilt, Status, Notes, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted, RowVersion`;

const FLOOR_COLUMNS = `Id, TenantId, BuildingId, FloorNumber, Name, CreatedAt, UpdatedAt,
  CreatedBy, UpdatedBy, IsDeleted, RowVersion`;

const rowVersion = (buffer: Buffer | null): string | null =>
  buffer ? Buffer.from(buffer).toString('base64') : null;

const toBuildingProps = (row: BuildingRow): BuildingProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  name: row.Name,
  address: row.Address,
  city: row.City,
  district: row.District,
  latitude: row.Latitude === null ? null : Number(row.Latitude),
  longitude: row.Longitude === null ? null : Number(row.Longitude),
  totalFloors: row.TotalFloors,
  yearBuilt: row.YearBuilt,
  status: row.Status,
  notes: row.Notes,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: rowVersion(row.RowVersion),
});

const toFloorProps = (row: FloorRow): FloorProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  buildingId: row.BuildingId,
  floorNumber: row.FloorNumber,
  name: row.Name,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: rowVersion(row.RowVersion),
});

/**
 * SQL Server implementation of the Building aggregate repository.
 * Fully parameterized; every query filters by TenantId (isolation) and
 * IsDeleted = 0 (soft delete). `save` upserts the root and its floors.
 */
export class SqlBuildingRepository implements IBuildingRepository {
  async findById(tenantId: string, id: string): Promise<Building | null> {
    const rows = await execQuery<BuildingRow>(
      `SELECT ${COLUMNS} FROM dbo.Buildings
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    return rows[0] ? Building.restore(toBuildingProps(rows[0])) : null;
  }

  async findByIdWithFloors(tenantId: string, id: string): Promise<Building | null> {
    const rows = await execQuery<BuildingRow>(
      `SELECT ${COLUMNS} FROM dbo.Buildings
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    if (!rows[0]) return null;
    const floorRows = await execQuery<FloorRow>(
      `SELECT ${FLOOR_COLUMNS} FROM dbo.Floors
       WHERE BuildingId = @id AND TenantId = @tenantId AND IsDeleted = 0
       ORDER BY FloorNumber`,
      { id, tenantId },
    );
    return Building.restore(
      toBuildingProps(rows[0]),
      floorRows.map((r) => Floor.restore(toFloorProps(r))),
    );
  }

  async existsByName(tenantId: string, name: string): Promise<boolean> {
    const rows = await execQuery(
      `SELECT 1 AS X FROM dbo.Buildings
       WHERE TenantId = @tenantId AND Name = @name AND IsDeleted = 0`,
      { tenantId, name },
    );
    return rows.length > 0;
  }

  async listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<Building>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.Buildings WHERE TenantId = @tenantId AND IsDeleted = 0`,
      { tenantId },
    );
    const rows = await execQuery<BuildingRow>(
      `SELECT ${COLUMNS} FROM dbo.Buildings
       WHERE TenantId = @tenantId AND IsDeleted = 0
       ORDER BY Name
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { tenantId, offset: (page.page - 1) * page.pageSize, pageSize: page.pageSize },
    );
    return {
      data: rows.map((row) => Building.restore(toBuildingProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Building>> {
    return this.listByTenant(tenantId, page);
  }

  async save(building: Building): Promise<void> {
    const p = building.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.Buildings WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.Buildings SET
           Name = @name, Address = @address, City = @city, District = @district,
           Latitude = @latitude, Longitude = @longitude, TotalFloors = @totalFloors,
           YearBuilt = @yearBuilt, Status = @status, Notes = @notes,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.Buildings
           (Id, TenantId, Name, Address, City, District, Latitude, Longitude, TotalFloors,
            YearBuilt, Status, Notes, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted)
         VALUES
           (@id, @tenantId, @name, @address, @city, @district, @latitude, @longitude, @totalFloors,
            @yearBuilt, @status, @notes, @createdAt, @updatedAt, @createdBy, @updatedBy, @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        name: p.name,
        address: p.address,
        city: p.city,
        district: p.district,
        latitude: p.latitude,
        longitude: p.longitude,
        totalFloors: p.totalFloors,
        yearBuilt: p.yearBuilt,
        status: p.status,
        notes: p.notes,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
    for (const floor of building.floors) {
      await this.saveFloor(floor);
    }
  }

  private async saveFloor(floor: Floor): Promise<void> {
    const p = floor.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.Floors WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.Floors SET
           FloorNumber = @floorNumber, Name = @name,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.Floors
           (Id, TenantId, BuildingId, FloorNumber, Name, CreatedAt, UpdatedAt,
            CreatedBy, UpdatedBy, IsDeleted)
         VALUES
           (@id, @tenantId, @buildingId, @floorNumber, @name, @createdAt, @updatedAt,
            @createdBy, @updatedBy, @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        buildingId: p.buildingId,
        floorNumber: p.floorNumber,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
  }

  async remove(building: Building): Promise<void> {
    const p = building.toProps();
    await execQuery(
      `UPDATE dbo.Buildings
       SET IsDeleted = 1, UpdatedAt = @updatedAt, UpdatedBy = @updatedBy
       WHERE Id = @id AND TenantId = @tenantId`,
      { id: p.id, tenantId: p.tenantId, updatedAt: p.updatedAt, updatedBy: p.updatedBy },
    );
  }
}
