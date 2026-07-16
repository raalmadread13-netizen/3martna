import {
  LeaseContract,
  LeaseContractProps,
  LeaseStatus,
  PaymentFrequency,
} from '@domain/business/LeaseContract';
import {
  ILeaseContractRepository,
  LeaseListQuery,
} from '@domain/repositories/business/leasing.repositories';
import { execQuery } from '@infrastructure/database/connection';
import { CursorResult, PageRequest, PageResult, decodeCursor, encodeCursor } from '@shared/types';

interface LeaseRow {
  Id: string;
  TenantId: string;
  ContractNumber: string;
  ApartmentId: string;
  OwnerId: string;
  ResidentId: string;
  StartDate: Date;
  EndDate: Date;
  MonthlyRent: number;
  Currency: string;
  DepositAmount: number;
  PaymentFrequency: PaymentFrequency;
  LateFeePercent: number;
  GraceDays: number;
  Status: LeaseStatus;
  TerminatedAt: Date | null;
  TerminationReason: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy: string | null;
  UpdatedBy: string | null;
  IsDeleted: boolean;
  RowVersion: Buffer;
}

const COLUMNS = `Id, TenantId, ContractNumber, ApartmentId, OwnerId, ResidentId, StartDate,
  EndDate, MonthlyRent, Currency, DepositAmount, PaymentFrequency, LateFeePercent, GraceDays,
  Status, TerminatedAt, TerminationReason, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy,
  IsDeleted, RowVersion`;

const toProps = (row: LeaseRow): LeaseContractProps => ({
  id: row.Id,
  tenantId: row.TenantId,
  contractNumber: row.ContractNumber,
  apartmentId: row.ApartmentId,
  ownerId: row.OwnerId,
  residentId: row.ResidentId,
  startDate: row.StartDate,
  endDate: row.EndDate,
  monthlyRent: Number(row.MonthlyRent),
  currency: row.Currency,
  depositAmount: Number(row.DepositAmount),
  paymentFrequency: row.PaymentFrequency,
  lateFeePercent: Number(row.LateFeePercent),
  graceDays: row.GraceDays,
  status: row.Status,
  terminatedAt: row.TerminatedAt,
  terminationReason: row.TerminationReason,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  createdBy: row.CreatedBy,
  updatedBy: row.UpdatedBy,
  isDeleted: row.IsDeleted,
  rowVersion: row.RowVersion ? Buffer.from(row.RowVersion).toString('base64') : null,
});

/** sortBy whitelist → SQL column (never interpolate user input directly). */
const SORT_COLUMNS: Record<LeaseListQuery['sortBy'], string> = {
  startDate: 'StartDate',
  endDate: 'EndDate',
  createdAt: 'CreatedAt',
  monthlyRent: 'MonthlyRent',
  contractNumber: 'ContractNumber',
};

const sortKeyOf = (row: LeaseRow, sortBy: LeaseListQuery['sortBy']): string | number => {
  switch (sortBy) {
    case 'startDate':
      return row.StartDate.toISOString();
    case 'endDate':
      return row.EndDate.toISOString();
    case 'createdAt':
      return row.CreatedAt.toISOString();
    case 'monthlyRent':
      return Number(row.MonthlyRent);
    case 'contractNumber':
      return row.ContractNumber;
  }
};

export class SqlLeaseContractRepository implements ILeaseContractRepository {
  async findById(tenantId: string, id: string): Promise<LeaseContract | null> {
    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE Id = @id AND TenantId = @tenantId AND IsDeleted = 0`,
      { id, tenantId },
    );
    return rows[0] ? LeaseContract.restore(toProps(rows[0])) : null;
  }

  async findActiveByApartment(
    tenantId: string,
    apartmentId: string,
  ): Promise<LeaseContract | null> {
    const rows = await execQuery<LeaseRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND ApartmentId = @apartmentId
         AND Status = 'Active' AND IsDeleted = 0`,
      { tenantId, apartmentId },
    );
    return rows[0] ? LeaseContract.restore(toProps(rows[0])) : null;
  }

  async findActiveByResident(tenantId: string, residentId: string): Promise<LeaseContract | null> {
    const rows = await execQuery<LeaseRow>(
      `SELECT TOP 1 ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND ResidentId = @residentId
         AND Status = 'Active' AND IsDeleted = 0`,
      { tenantId, residentId },
    );
    return rows[0] ? LeaseContract.restore(toProps(rows[0])) : null;
  }

  async existsByContractNumber(tenantId: string, contractNumber: string): Promise<boolean> {
    const rows = await execQuery(
      `SELECT 1 AS X FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND ContractNumber = @contractNumber AND IsDeleted = 0`,
      { tenantId, contractNumber },
    );
    return rows.length > 0;
  }

  async existsOverlapping(
    tenantId: string,
    apartmentId: string,
    startDate: Date,
    endDate: Date,
    excludeLeaseId?: string,
  ): Promise<boolean> {
    const rows = await execQuery(
      `SELECT 1 AS X FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND ApartmentId = @apartmentId
         AND Status IN ('Draft', 'Active') AND IsDeleted = 0
         AND StartDate < @endDate AND EndDate > @startDate
         AND (@excludeLeaseId IS NULL OR Id <> @excludeLeaseId)`,
      { tenantId, apartmentId, startDate, endDate, excludeLeaseId: excludeLeaseId ?? null },
    );
    return rows.length > 0;
  }

  async listCursor(tenantId: string, query: LeaseListQuery): Promise<CursorResult<LeaseContract>> {
    const sortColumn = SORT_COLUMNS[query.sortBy];
    const direction = query.sortDir === 'desc' ? 'DESC' : 'ASC';
    const comparator = query.sortDir === 'desc' ? '<' : '>';
    const position = decodeCursor(query.cursor);

    const filters: string[] = [];
    const params: Record<string, unknown> = { tenantId, limitPlusOne: query.limit + 1 };
    if (query.search) {
      filters.push('ContractNumber LIKE @search');
      params.search = `%${query.search}%`;
    }
    if (query.status) {
      filters.push('Status = @status');
      params.status = query.status;
    }
    if (query.apartmentId) {
      filters.push('ApartmentId = @apartmentId');
      params.apartmentId = query.apartmentId;
    }
    if (query.residentId) {
      filters.push('ResidentId = @residentId');
      params.residentId = query.residentId;
    }
    if (position) {
      filters.push(
        `(${sortColumn} ${comparator} @cursorKey OR (${sortColumn} = @cursorKey AND Id > @cursorId))`,
      );
      params.cursorKey =
        query.sortBy === 'monthlyRent'
          ? Number(position.k)
          : query.sortBy === 'contractNumber'
            ? String(position.k)
            : new Date(String(position.k));
      params.cursorId = position.id;
    }

    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND IsDeleted = 0
         ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
       ORDER BY ${sortColumn} ${direction}, Id ASC
       OFFSET 0 ROWS FETCH NEXT @limitPlusOne ROWS ONLY`,
      params,
    );

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      data: page.map((row) => LeaseContract.restore(toProps(row))),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ k: sortKeyOf(last, query.sortBy), id: last.Id })
          : null,
      limit: query.limit,
    };
  }

  async listByResident(
    tenantId: string,
    residentId: string,
    page: PageRequest,
  ): Promise<PageResult<LeaseContract>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND ResidentId = @residentId AND IsDeleted = 0`,
      { tenantId, residentId },
    );
    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND ResidentId = @residentId AND IsDeleted = 0
       ORDER BY StartDate DESC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { tenantId, residentId, offset: (page.page - 1) * page.pageSize, pageSize: page.pageSize },
    );
    return {
      data: rows.map((row) => LeaseContract.restore(toProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async listActiveEndingBetween(tenantId: string, from: Date, to: Date): Promise<LeaseContract[]> {
    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND Status = 'Active' AND IsDeleted = 0
         AND EndDate > @from AND EndDate <= @to
       ORDER BY EndDate`,
      { tenantId, from, to },
    );
    return rows.map((row) => LeaseContract.restore(toProps(row)));
  }

  async listExpired(tenantId: string, asOf: Date): Promise<LeaseContract[]> {
    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND IsDeleted = 0
         AND (Status = 'Expired' OR (Status = 'Active' AND EndDate <= @asOf))
       ORDER BY EndDate DESC`,
      { tenantId, asOf },
    );
    return rows.map((row) => LeaseContract.restore(toProps(row)));
  }

  async listActiveEndedBefore(tenantId: string, asOf: Date): Promise<LeaseContract[]> {
    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND Status = 'Active' AND EndDate <= @asOf AND IsDeleted = 0`,
      { tenantId, asOf },
    );
    return rows.map((row) => LeaseContract.restore(toProps(row)));
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<LeaseContract>> {
    const [{ Total: totalCount }] = await execQuery<{ Total: number }>(
      `SELECT COUNT(*) AS Total FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND IsDeleted = 0`,
      { tenantId },
    );
    const rows = await execQuery<LeaseRow>(
      `SELECT ${COLUMNS} FROM dbo.LeaseContracts
       WHERE TenantId = @tenantId AND IsDeleted = 0
       ORDER BY StartDate DESC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      { tenantId, offset: (page.page - 1) * page.pageSize, pageSize: page.pageSize },
    );
    return {
      data: rows.map((row) => LeaseContract.restore(toProps(row))),
      pagination: {
        page: page.page,
        pageSize: page.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / page.pageSize),
      },
    };
  }

  async save(lease: LeaseContract): Promise<void> {
    const p = lease.toProps();
    await execQuery(
      `IF EXISTS (SELECT 1 FROM dbo.LeaseContracts WHERE Id = @id AND TenantId = @tenantId)
         UPDATE dbo.LeaseContracts SET
           EndDate = @endDate, MonthlyRent = @monthlyRent, Currency = @currency,
           DepositAmount = @depositAmount, PaymentFrequency = @paymentFrequency,
           LateFeePercent = @lateFeePercent, GraceDays = @graceDays, Status = @status,
           TerminatedAt = @terminatedAt, TerminationReason = @terminationReason,
           UpdatedAt = @updatedAt, UpdatedBy = @updatedBy, IsDeleted = @isDeleted
         WHERE Id = @id AND TenantId = @tenantId
       ELSE
         INSERT INTO dbo.LeaseContracts
           (Id, TenantId, ContractNumber, ApartmentId, OwnerId, ResidentId, StartDate, EndDate,
            MonthlyRent, Currency, DepositAmount, PaymentFrequency, LateFeePercent, GraceDays,
            Status, TerminatedAt, TerminationReason, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy,
            IsDeleted)
         VALUES
           (@id, @tenantId, @contractNumber, @apartmentId, @ownerId, @residentId, @startDate,
            @endDate, @monthlyRent, @currency, @depositAmount, @paymentFrequency, @lateFeePercent,
            @graceDays, @status, @terminatedAt, @terminationReason, @createdAt, @updatedAt,
            @createdBy, @updatedBy, @isDeleted)`,
      {
        id: p.id,
        tenantId: p.tenantId,
        contractNumber: p.contractNumber,
        apartmentId: p.apartmentId,
        ownerId: p.ownerId,
        residentId: p.residentId,
        startDate: p.startDate,
        endDate: p.endDate,
        monthlyRent: p.monthlyRent,
        currency: p.currency,
        depositAmount: p.depositAmount,
        paymentFrequency: p.paymentFrequency,
        lateFeePercent: p.lateFeePercent,
        graceDays: p.graceDays,
        status: p.status,
        terminatedAt: p.terminatedAt,
        terminationReason: p.terminationReason,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy,
        isDeleted: p.isDeleted,
      },
    );
  }

  async remove(lease: LeaseContract): Promise<void> {
    const p = lease.toProps();
    await execQuery(
      `UPDATE dbo.LeaseContracts
       SET IsDeleted = 1, UpdatedAt = @updatedAt, UpdatedBy = @updatedBy
       WHERE Id = @id AND TenantId = @tenantId`,
      { id: p.id, tenantId: p.tenantId, updatedAt: p.updatedAt, updatedBy: p.updatedBy },
    );
  }
}
