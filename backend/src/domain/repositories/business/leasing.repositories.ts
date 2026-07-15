import { LeaseContract } from '@domain/business/LeaseContract';
import { Invoice, Payment } from '@domain/business/Billing';
import { PageRequest, PageResult } from '@shared/types';
import { ITenantRepository } from './ITenantRepository';

export interface ILeaseContractRepository extends ITenantRepository<LeaseContract> {
  /** The single active lease for an apartment, if any (invariant guard). */
  findActiveByApartment(tenantId: string, apartmentId: string): Promise<LeaseContract | null>;
  existsByContractNumber(tenantId: string, contractNumber: string): Promise<boolean>;
  listByResident(
    tenantId: string,
    residentId: string,
    page: PageRequest,
  ): Promise<PageResult<LeaseContract>>;
  /** Active leases whose end date has passed (expiry job). */
  listActiveEndedBefore(tenantId: string, asOf: Date): Promise<LeaseContract[]>;
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
