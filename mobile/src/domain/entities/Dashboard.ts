import { Lease } from './Occupancy';

/** Mirrors the backend dashboard DTOs (Sprint 6). */

export interface DashboardSummary {
  totalBuildings: number;
  totalApartments: number;
  occupiedApartments: number;
  vacantApartments: number;
  totalOwners: number;
  totalResidents: number;
  activeLeases: number;
  expiringLeases: number;
  openMaintenanceRequests: number;
  occupancyRate: number;
  asOf: string;
}

export interface BuildingSummary {
  buildingId: string;
  name: string;
  address: string;
  city: string;
  apartmentCount: number;
  occupied: number;
  vacant: number;
  occupancyPercent: number;
}

export interface LeaseAlerts {
  expiringSoon: Lease[];
  expired: Lease[];
}

export interface RecentActivity {
  type: string;
  occurredAt: string;
  entityId: string;
  description: string;
}
