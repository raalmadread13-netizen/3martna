import { LeaseContractDto } from './leasing.dto';

/** Read DTOs for the admin dashboard (Sprint 6). */

export interface DashboardSummaryDto {
  totalBuildings: number;
  totalApartments: number;
  occupiedApartments: number;
  vacantApartments: number;
  totalOwners: number;
  totalResidents: number;
  activeLeases: number;
  /** Active leases ending within the next 30 days. */
  expiringLeases: number;
  /** Placeholder until the Maintenance module ships. */
  openMaintenanceRequests: number;
  /** occupied / total apartments, 0–100 (0 when there are no apartments). */
  occupancyRate: number;
  /** Instant the numbers were computed (from IClock). */
  asOf: string;
}

export interface BuildingSummaryDto {
  buildingId: string;
  name: string;
  address: string;
  city: string;
  apartmentCount: number;
  occupied: number;
  vacant: number;
  /** 0–100, rounded; 0 when the building has no apartments. */
  occupancyPercent: number;
}

export interface LeaseAlertsDto {
  /** Active leases ending within the next 30 days, soonest first. */
  expiringSoon: LeaseContractDto[];
  /** Expired leases (status Expired, or Active past their end date). */
  expired: LeaseContractDto[];
}

export interface RecentActivityDto {
  type: string;
  occurredAt: string;
  entityId: string;
  description: string;
}
