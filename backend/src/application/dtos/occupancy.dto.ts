/** Read/write DTOs for the Occupancy module. */

export interface OccupancyDto {
  id: string;
  tenantId: string;
  apartmentId: string;
  residentId: string;
  leaseContractId: string;
  moveInDate: string;
  moveOutDate: string | null;
  moveOutReason: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateResidentDto {
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  residencyType?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface UpdateResidentDto {
  fullName?: string;
  phoneNumber?: string;
  email?: string | null;
  residencyType?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface CreateLeaseDto {
  apartmentId: string;
  residentId: string;
  /** Auto-generated when omitted. */
  contractNumber?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  currency?: string;
  depositAmount?: number;
  paymentFrequency?: string;
  lateFeePercent?: number;
  graceDays?: number;
}

export interface UpdateLeaseDto {
  /** Extension: must be after the current end date. */
  endDate: string;
}

export interface TerminateLeaseDto {
  reason: string;
}

export interface MoveInDto {
  leaseId: string;
  /** Business-effective date; defaults to the lease start date. */
  moveInDate?: string;
}

export interface MoveOutDto {
  /** Business-effective date; defaults to today. */
  moveOutDate?: string;
  reason?: string | null;
}

/*
 * Cursor list queries are repository contracts and live next to their
 * repository interfaces in the domain layer:
 *   ResidentListQuery  → @domain/repositories/business/property.repositories
 *   LeaseListQuery     → @domain/repositories/business/leasing.repositories
 *   OccupancyListQuery → @domain/repositories/business/occupancy.repositories
 */
