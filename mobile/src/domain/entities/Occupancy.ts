/** Mirrors the backend Occupancy-module DTOs (Sprint 5). */

export type ResidencyType = 'OwnerOccupant' | 'LeaseTenant' | 'FamilyMember';
export type LeaseStatus = 'Draft' | 'Active' | 'Expired' | 'Terminated' | 'Cancelled';

export interface Resident {
  id: string;
  tenantId: string;
  apartmentId: string | null;
  userId: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  residencyType: ResidencyType;
  moveInDate: string | null;
  moveOutDate: string | null;
  isActive: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: string;
}

export interface Lease {
  id: string;
  tenantId: string;
  contractNumber: string;
  apartmentId: string;
  ownerId: string;
  residentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  currency: string;
  depositAmount: number;
  paymentFrequency: string;
  lateFeePercent: number;
  graceDays: number;
  status: LeaseStatus;
  terminatedAt: string | null;
  terminationReason: string | null;
  createdAt: string;
}

export interface OccupancyRecord {
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

/** Cursor page envelope returned by the Sprint 5 list endpoints. */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  limit: number;
}

/* ------------------------ write payloads ----------------------- */

export interface CreateResidentInput {
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  residencyType?: ResidencyType;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

export interface CreateLeaseInput {
  apartmentId: string;
  residentId: string;
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

export interface ResidentListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive';
  apartmentId?: string;
  sortBy?: 'fullName' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface LeaseListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: LeaseStatus;
  apartmentId?: string;
  residentId?: string;
  sortBy?: 'startDate' | 'endDate' | 'createdAt' | 'monthlyRent' | 'contractNumber';
  sortDir?: 'asc' | 'desc';
}

export interface OccupancyListParams {
  cursor?: string;
  limit?: number;
  apartmentId?: string;
  residentId?: string;
  leaseId?: string;
  active?: boolean;
  sortBy?: 'moveInDate' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}
