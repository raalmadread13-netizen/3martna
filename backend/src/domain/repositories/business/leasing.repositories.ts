import { LeaseContract } from '@domain/business/LeaseContract';
import { Invoice, Payment } from '@domain/business/Billing';
import { CursorResult, PageRequest, PageResult, SortDirection } from '@shared/types';
import { ITenantRepository } from './ITenantRepository';

/** Cursor-list query for lease contracts. */
export interface LeaseListQuery {
  cursor?: string;
  limit: number;
  sortBy: 'startDate' | 'endDate' | 'createdAt' | 'monthlyRent' | 'contractNumber';
  sortDir: SortDirection;
  /** Matches the contract number (contains). */
  search?: string;
  status?: string;
  apartmentId?: string;
  residentId?: string;
}

export interface ILeaseContractRepository extends ITenantRepository<LeaseContract> {
  /** The single active lease for an apartment, if any (invariant guard). */
  findActiveByApartment(tenantId: string, apartmentId: string): Promise<LeaseContract | null>;
  /** The single active lease for a resident, if any (invariant guard). */
  findActiveByResident(tenantId: string, residentId: string): Promise<LeaseContract | null>;
  existsByContractNumber(tenantId: string, contractNumber: string): Promise<boolean>;
  /**
   * Whether a Draft/Active lease of the apartment overlaps [start, end).
   * Terminated/Expired/Cancelled leases are history and never block.
   */
  existsOverlapping(
    tenantId: string,
    apartmentId: string,
    startDate: Date,
    endDate: Date,
    excludeLeaseId?: string,
  ): Promise<boolean>;
  /** Cursor-paged list with search/filter/sort. */
  listCursor(tenantId: string, query: LeaseListQuery): Promise<CursorResult<LeaseContract>>;
  listByResident(
    tenantId: string,
    residentId: string,
    page: PageRequest,
  ): Promise<PageResult<LeaseContract>>;
  /** Active leases whose end date has passed (expiry job). */
  listActiveEndedBefore(tenantId: string, asOf: Date): Promise<LeaseContract[]>;
  /** Active leases ending inside (from, to] — the "expiring soon" alert. */
  listActiveEndingBetween(tenantId: string, from: Date, to: Date): Promise<LeaseContract[]>;
  /** Ended leases: Status Expired, or Active past their end date (alert). */
  listExpired(tenantId: string, asOf: Date): Promise<LeaseContract[]>;
}

export interface IInvoiceRepository extends ITenantRepository<Invoice> {
  /** Rehydrates the invoice with its confirmed paid total. */
  findByIdWithPayments(tenantId: string, id: string): Promise<Invoice | null>;
  existsByInvoiceNumber(tenantId: string, invoiceNumber: string): Promise<boolean>;
  listByApartment(
    tenantId: string,
    apartmentId: string,
    page: PageRequest,
  ): Promise<PageResult<Invoice>>;
  /** Issued/partially-paid invoices past due (overdue job). */
  listPayableDueBefore(tenantId: string, asOf: Date): Promise<Invoice[]>;
}

export interface IPaymentRepository extends ITenantRepository<Payment> {
  listByInvoice(tenantId: string, invoiceId: string): Promise<Payment[]>;
}
