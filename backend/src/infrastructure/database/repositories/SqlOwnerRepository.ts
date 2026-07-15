import { Owner, OwnerProps, OwnerType } from '@domain/business/Owner';
import { IOwnerRepository } from '@domain/repositories/business/property.repositories';
import { execQuery } from '@infrastructure/database/connection';
import { PageRequest, PageResult } from '@shared/types';

interface OwnerRow {
  Id: string;
  TenantId: string;
  OwnerType: OwnerType;
  UserId: string | null;
  FullName: string;
  CompanyName: string | null;
  NationalIdOrRegistration: string | null;
  Email: string | null;
  PhoneNumber: string | null;
  Address: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

const COLUMNS = `Id, TenantId, OwnerType, UserId, FullName, CompanyName,
  NationalIdOrRegistration, Email, PhoneNumber, Address, CreatedAt, UpdatedAt,
  CreatedBy, UpdatedBy, IsDeleted, RowVersion`;

const toProps = (row: OwnerRow): OwnerProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  ownerType: row.OwnerType,
  userId: row.UserId,
  fullName: row.FullName,
  companyName: row.CompanyName,
  nationalIdOrRegistration: row.NationalIdOrRegistration,
  email: row.Email,
  phoneNumber: row.PhoneNumber,
  address: row.Address,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: row.RowVersion ? Buffer.from(row.RowVersion).toString('base64') : null,
});

/**
 * SQL Server implementation of the Owner aggregate repository.
 * Fully parameterized; tenant-scoped and soft-delete filtered throughout.
 */
export class SqlOwnerRepository implements IOwnerRepository {
  async findById(tenantId: string, id: string): Promise<Owner | null> {
    const rows = await execQuery<OwnerRow>(
      `SELECT ${COLUMNS} FROM dbo.Owners
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    return rows[0] ? Owner.restore(toProps(rows[0])) : null;
  }

  async findByUserId(tenantId: string, userId: string): Promise<Owner | null> {
    const rows = await execQuery<OwnerRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.Owners
       WHERE UserId = @userId AND TenantId = @tenantId AND IsDeleted = 0`,
      { userId, tenantId },
    );
    return rows[0] ? Owner.restore(toProps(rows[0])) : null;
  }

  async listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<Owner>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.Owners WHERE TenantId = @tenantId AND IsDeleted = 0`,
      { tenantId },
    );
    const rows = await execQuery<OwnerRow>(
      `SELECT ${COLUMNS} FROM dbo.Owners
       WHERE TenantId = @tenantId AND IsDeleted = 0
       ORDER BY FullName
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { tenantId, offset: (page.page - 1) * page.pageSize, pageSize: page.pageSize },
    );
    return {
      data: rows.map((row) => Owner.restore(toProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Owner>> {
    return this.listByTenant(tenantId, page);
  }

  async save(owner: Owner): Promise<void> {
    const p = owner.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.Owners WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.Owners SET
           OwnerType = @ownerType, UserId = @userId, FullName = @fullName,
           CompanyName = @companyName, NationalIdOrRegistration = @nationalIdOrRegistration,
           Email = @email, PhoneNumber = @phoneNumber, Address = @address,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.Owners
           (Id, TenantId, OwnerType, UserId, FullName, CompanyName, NationalIdOrRegistration,
            Email, PhoneNumber, Address, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted)
         VALUES
           (@id, @tenantId, @ownerType, @userId, @fullName, @companyName,
            @nationalIdOrRegistration, @email, @phoneNumber, @address, @createdAt, @updatedAt,
            @createdBy, @updatedBy, @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        ownerType: p.ownerType,
        userId: p.userId,
        fullName: p.fullName,
        companyName: p.companyName,
        nationalIdOrRegistration: p.nationalIdOrRegistration,
        email: p.email,
        phoneNumber: p.phoneNumber,
        address: p.address,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
  }

  async remove(owner: Owner): Promise<void> {
    const p = owner.toProps();
    await execQuery(
      `UPDATE dbo.Owners
       SET IsDeleted = 1, UpdatedAt = @updatedAt, UpdatedBy = @updatedBy
       WHERE Id = @id AND TenantId = @tenantId`,
      { id: p.id, tenantId: p.tenantId, updatedAt: p.updatedAt, updatedBy: p.updatedBy },
    );
  }
}
