import { Occupancy } from '@domain/business/Occupancy';
import { CursorResult, SortDirection } from '@shared/types';
import { ITenantRepository } from './ITenantRepository';

/** Cursor-list query for occupancy history. */
export interface OccupancyListQuery {
  cursor?: string;
  limit: number;
  sortBy: 'moveInDate' | 'createdAt';
  sortDir: SortDirection;
  apartmentId?: string;
  residentId?: string;
  leaseId?: string;
  active?: boolean;
}

export interface IOccupancyRepository extends ITenantRepository<Occupancy> {
  /** The single ACTIVE stay for an apartment, if any (invariant guard). */
  findActiveByApartment(tenantId: string, apartmentId: string): Promise<Occupancy | null>;
  /** The single ACTIVE stay for a resident, if any (invariant guard). */
  findActiveByResident(tenantId: string, residentId: string): Promise<Occupancy | null>;
  /** The ACTIVE stay opened under a lease (terminate → auto move-out). */
  findActiveByLease(tenantId: string, leaseContractId: string): Promise<Occupancy | null>;
  /** Cursor-paged history — filters by apartment/resident/lease/active. */
  listCursor(tenantId: string, query: OccupancyListQuery): Promise<CursorResult<Occupancy>>;
}
