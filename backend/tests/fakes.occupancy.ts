import { LeaseContract, LeaseContractProps } from '@domain/business/LeaseContract';
import { Occupancy, OccupancyProps } from '@domain/business/Occupancy';
import { Resident, ResidentProps } from '@domain/business/Resident';
import {
  ILeaseContractRepository,
  LeaseListQuery,
} from '@domain/repositories/business/leasing.repositories';
import {
  IOccupancyRepository,
  OccupancyListQuery,
} from '@domain/repositories/business/occupancy.repositories';
import {
  IResidentRepository,
  ResidentListQuery,
} from '@domain/repositories/business/property.repositories';
import {
  IIdempotencyStore,
  IdempotencyBeginResult,
} from '@application/interfaces/IIdempotencyStore';
import { CursorResult, PageRequest, PageResult, paginateByCursor } from '@shared/types';

/*
 * In-memory implementations of the Sprint 5 repository contracts. Same
 * philosophy as fakes.property.ts: rows are stored as plain props and
 * aggregates rehydrate per call, mirroring the SQL implementations.
 */

const pageOf = <TProps, TAgg>(
  rows: TProps[],
  page: PageRequest,
  restore: (props: TProps) => TAgg,
): PageResult<TAgg> => {
  const start = (page.page - 1) * page.pageSize;
  return {
    data: rows.slice(start, start + page.pageSize).map(restore),
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      totalCount: rows.length,
      totalPages: Math.ceil(rows.length / page.pageSize),
    },
  };
};

export class InMemoryResidentRepository implements IResidentRepository {
  residents = new Map<string, ResidentProps>();

  private alive(tenantId: string): ResidentProps[] {
    return [...this.residents.values()].filter((r) => r.tenantId === tenantId && !r.isDeleted);
  }

  async findById(tenantId: string, id: string): Promise<Resident | null> {
    const props = this.residents.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return Resident.restore({ ...props });
  }

  async findByUserId(tenantId: string, userId: string): Promise<Resident | null> {
    const props = this.alive(tenantId).find((r) => r.userId === userId);
    return props ? Resident.restore({ ...props }) : null;
  }

  async listActiveByApartment(tenantId: string, apartmentId: string): Promise<Resident[]> {
    return this.alive(tenantId)
      .filter((r) => r.apartmentId === apartmentId && r.moveOutDate === null)
      .map((r) => Resident.restore({ ...r }));
  }

  async listCursor(tenantId: string, query: ResidentListQuery): Promise<CursorResult<Resident>> {
    let rows = this.alive(tenantId);
    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.fullName.toLowerCase().includes(term) ||
          r.phoneNumber.includes(query.search!) ||
          (r.email ?? '').toLowerCase().includes(term),
      );
    }
    if (query.apartmentId) rows = rows.filter((r) => r.apartmentId === query.apartmentId);
    if (query.status === 'active') {
      rows = rows.filter((r) => r.apartmentId !== null && r.moveOutDate === null);
    } else if (query.status === 'inactive') {
      rows = rows.filter((r) => r.apartmentId === null || r.moveOutDate !== null);
    }

    const { rows: window, nextCursor } = paginateByCursor(
      rows,
      query,
      (r) => (query.sortBy === 'createdAt' ? r.createdAt.toISOString() : r.fullName),
      (r) => r.id,
    );
    return {
      data: window.map((r) => Resident.restore({ ...r })),
      nextCursor,
      limit: query.limit,
    };
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Resident>> {
    const rows = this.alive(tenantId).sort((a, b) => a.fullName.localeCompare(b.fullName));
    return pageOf(rows, page, (props) => Resident.restore({ ...props }));
  }

  async save(resident: Resident): Promise<void> {
    this.residents.set(resident.id, resident.toProps());
  }

  async remove(resident: Resident): Promise<void> {
    this.residents.set(resident.id, resident.toProps());
  }
}

export class InMemoryLeaseContractRepository implements ILeaseContractRepository {
  leases = new Map<string, LeaseContractProps>();

  private alive(tenantId: string): LeaseContractProps[] {
    return [...this.leases.values()].filter((l) => l.tenantId === tenantId && !l.isDeleted);
  }

  async findById(tenantId: string, id: string): Promise<LeaseContract | null> {
    const props = this.leases.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return LeaseContract.restore({ ...props });
  }

  async findActiveByApartment(
    tenantId: string,
    apartmentId: string,
  ): Promise<LeaseContract | null> {
    const props = this.alive(tenantId).find(
      (l) => l.apartmentId === apartmentId && l.status === 'Active',
    );
    return props ? LeaseContract.restore({ ...props }) : null;
  }

  async findActiveByResident(tenantId: string, residentId: string): Promise<LeaseContract | null> {
    const props = this.alive(tenantId).find(
      (l) => l.residentId === residentId && l.status === 'Active',
    );
    return props ? LeaseContract.restore({ ...props }) : null;
  }

  async existsByContractNumber(tenantId: string, contractNumber: string): Promise<boolean> {
    return this.alive(tenantId).some((l) => l.contractNumber === contractNumber);
  }

  async existsOverlapping(
    tenantId: string,
    apartmentId: string,
    startDate: Date,
    endDate: Date,
    excludeLeaseId?: string,
  ): Promise<boolean> {
    return this.alive(tenantId).some(
      (l) =>
        l.apartmentId === apartmentId &&
        (l.status === 'Draft' || l.status === 'Active') &&
        l.id !== excludeLeaseId &&
        l.startDate.getTime() < endDate.getTime() &&
        l.endDate.getTime() > startDate.getTime(),
    );
  }

  async listCursor(tenantId: string, query: LeaseListQuery): Promise<CursorResult<LeaseContract>> {
    let rows = this.alive(tenantId);
    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter((l) => l.contractNumber.toLowerCase().includes(term));
    }
    if (query.status) rows = rows.filter((l) => l.status === query.status);
    if (query.apartmentId) rows = rows.filter((l) => l.apartmentId === query.apartmentId);
    if (query.residentId) rows = rows.filter((l) => l.residentId === query.residentId);

    const sortKey = (l: LeaseContractProps): string | number => {
      switch (query.sortBy) {
        case 'startDate':
          return l.startDate.toISOString();
        case 'endDate':
          return l.endDate.toISOString();
        case 'createdAt':
          return l.createdAt.toISOString();
        case 'monthlyRent':
          return l.monthlyRent;
        case 'contractNumber':
          return l.contractNumber;
      }
    };
    const { rows: window, nextCursor } = paginateByCursor(rows, query, sortKey, (l) => l.id);
    return {
      data: window.map((l) => LeaseContract.restore({ ...l })),
      nextCursor,
      limit: query.limit,
    };
  }

  async listByResident(
    tenantId: string,
    residentId: string,
    page: PageRequest,
  ): Promise<PageResult<LeaseContract>> {
    const rows = this.alive(tenantId)
      .filter((l) => l.residentId === residentId)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    return pageOf(rows, page, (props) => LeaseContract.restore({ ...props }));
  }

  async listActiveEndedBefore(tenantId: string, asOf: Date): Promise<LeaseContract[]> {
    return this.alive(tenantId)
      .filter((l) => l.status === 'Active' && l.endDate.getTime() <= asOf.getTime())
      .map((l) => LeaseContract.restore({ ...l }));
  }

  async listActiveEndingBetween(tenantId: string, from: Date, to: Date): Promise<LeaseContract[]> {
    return this.alive(tenantId)
      .filter(
        (l) =>
          l.status === 'Active' &&
          l.endDate.getTime() > from.getTime() &&
          l.endDate.getTime() <= to.getTime(),
      )
      .map((l) => LeaseContract.restore({ ...l }));
  }

  async listExpired(tenantId: string, asOf: Date): Promise<LeaseContract[]> {
    return this.alive(tenantId)
      .filter(
        (l) =>
          l.status === 'Expired' ||
          (l.status === 'Active' && l.endDate.getTime() <= asOf.getTime()),
      )
      .map((l) => LeaseContract.restore({ ...l }));
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<LeaseContract>> {
    const rows = this.alive(tenantId).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    return pageOf(rows, page, (props) => LeaseContract.restore({ ...props }));
  }

  async save(lease: LeaseContract): Promise<void> {
    this.leases.set(lease.id, lease.toProps());
  }

  async remove(lease: LeaseContract): Promise<void> {
    this.leases.set(lease.id, lease.toProps());
  }
}

export class InMemoryOccupancyRepository implements IOccupancyRepository {
  occupancies = new Map<string, OccupancyProps>();

  private alive(tenantId: string): OccupancyProps[] {
    return [...this.occupancies.values()].filter((o) => o.tenantId === tenantId && !o.isDeleted);
  }

  async findById(tenantId: string, id: string): Promise<Occupancy | null> {
    const props = this.occupancies.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return Occupancy.restore({ ...props });
  }

  async findActiveByApartment(tenantId: string, apartmentId: string): Promise<Occupancy | null> {
    const props = this.alive(tenantId).find(
      (o) => o.apartmentId === apartmentId && o.moveOutDate === null,
    );
    return props ? Occupancy.restore({ ...props }) : null;
  }

  async findActiveByResident(tenantId: string, residentId: string): Promise<Occupancy | null> {
    const props = this.alive(tenantId).find(
      (o) => o.residentId === residentId && o.moveOutDate === null,
    );
    return props ? Occupancy.restore({ ...props }) : null;
  }

  async findActiveByLease(tenantId: string, leaseContractId: string): Promise<Occupancy | null> {
    const props = this.alive(tenantId).find(
      (o) => o.leaseContractId === leaseContractId && o.moveOutDate === null,
    );
    return props ? Occupancy.restore({ ...props }) : null;
  }

  async listCursor(tenantId: string, query: OccupancyListQuery): Promise<CursorResult<Occupancy>> {
    let rows = this.alive(tenantId);
    if (query.apartmentId) rows = rows.filter((o) => o.apartmentId === query.apartmentId);
    if (query.residentId) rows = rows.filter((o) => o.residentId === query.residentId);
    if (query.leaseId) rows = rows.filter((o) => o.leaseContractId === query.leaseId);
    if (query.active === true) rows = rows.filter((o) => o.moveOutDate === null);
    if (query.active === false) rows = rows.filter((o) => o.moveOutDate !== null);

    const { rows: window, nextCursor } = paginateByCursor(
      rows,
      query,
      (o) =>
        query.sortBy === 'moveInDate' ? o.moveInDate.toISOString() : o.createdAt.toISOString(),
      (o) => o.id,
    );
    return {
      data: window.map((o) => Occupancy.restore({ ...o })),
      nextCursor,
      limit: query.limit,
    };
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Occupancy>> {
    const rows = this.alive(tenantId).sort(
      (a, b) => b.moveInDate.getTime() - a.moveInDate.getTime(),
    );
    return pageOf(rows, page, (props) => Occupancy.restore({ ...props }));
  }

  async save(occupancy: Occupancy): Promise<void> {
    this.occupancies.set(occupancy.id, occupancy.toProps());
  }

  async remove(occupancy: Occupancy): Promise<void> {
    this.occupancies.set(occupancy.id, occupancy.toProps());
  }
}

interface IdemRecord {
  requestHash: string;
  status: 'in_progress' | 'completed';
  responseStatus?: number;
  responseBody?: string;
}

export class InMemoryIdempotencyStore implements IIdempotencyStore {
  records = new Map<string, IdemRecord>();

  private id(scope: string, key: string): string {
    return `${scope}\n${key}`;
  }

  async begin(scope: string, key: string, requestHash: string): Promise<IdempotencyBeginResult> {
    const existing = this.records.get(this.id(scope, key));
    if (!existing) {
      this.records.set(this.id(scope, key), { requestHash, status: 'in_progress' });
      return { kind: 'started' };
    }
    if (existing.requestHash !== requestHash) return { kind: 'mismatch' };
    if (existing.status === 'in_progress') return { kind: 'in_progress' };
    return {
      kind: 'replay',
      responseStatus: existing.responseStatus,
      responseBody: existing.responseBody,
    };
  }

  async complete(
    scope: string,
    key: string,
    responseStatus: number,
    responseBody: string,
  ): Promise<void> {
    this.records.set(this.id(scope, key), {
      requestHash: this.records.get(this.id(scope, key))?.requestHash ?? '',
      status: 'completed',
      responseStatus,
      responseBody,
    });
  }

  async release(scope: string, key: string): Promise<void> {
    const existing = this.records.get(this.id(scope, key));
    if (existing?.status === 'in_progress') this.records.delete(this.id(scope, key));
  }
}
