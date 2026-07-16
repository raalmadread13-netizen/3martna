/**
 * Dashboard read model (Sprint 6). A dedicated reporting contract so the
 * statistics come from AGGREGATED queries — one round trip for the counts,
 * one grouped query for the building summaries, one union for the activity
 * feed. Never loops over aggregates (no N+1); never mutates anything.
 */

export interface DashboardCounts {
  totalBuildings: number;
  totalApartments: number;
  /** Apartments with an ACTIVE occupancy (one stay per apartment). */
  occupiedApartments: number;
  totalOwners: number;
  /** Registered residents (placed or not). */
  totalResidents: number;
  activeLeases: number;
  /** Active leases ending within the given window (see use-case). */
  expiringLeases: number;
}

export interface BuildingOccupancyRow {
  buildingId: string;
  name: string;
  address: string;
  city: string;
  apartmentCount: number;
  occupied: number;
}

export type RecentActivityType =
  | 'BuildingCreated'
  | 'ApartmentAdded'
  | 'ResidentRegistered'
  | 'LeaseCreated'
  | 'MoveIn'
  | 'MoveOut';

export interface RecentActivityRow {
  type: RecentActivityType;
  occurredAt: Date;
  entityId: string;
  /** Human label of the subject (building name, unit number, …). */
  label: string;
}

export interface IDashboardRepository {
  /** All headline counts in one round trip. */
  getCounts(tenantId: string, now: Date, expiringUntil: Date): Promise<DashboardCounts>;
  /** Per-building apartment/occupancy aggregates (single grouped query). */
  getBuildingSummaries(tenantId: string): Promise<BuildingOccupancyRow[]>;
  /**
   * Latest domain events, newest first — derived from the tables'
   * timestamps (creation ledger + occupancy history), not a log table.
   */
  getRecentActivity(tenantId: string, limit: number): Promise<RecentActivityRow[]>;
}
