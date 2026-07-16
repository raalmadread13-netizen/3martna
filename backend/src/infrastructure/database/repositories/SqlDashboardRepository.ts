import {
  BuildingOccupancyRow,
  DashboardCounts,
  IDashboardRepository,
  RecentActivityRow,
  RecentActivityType,
} from '@domain/repositories/business/dashboard.repositories';
import { execQuery } from '@infrastructure/database/connection';

interface CountsRow {
  TotalBuildings: number;
  TotalApartments: number;
  OccupiedApartments: number;
  TotalOwners: number;
  TotalResidents: number;
  ActiveLeases: number;
  ExpiringLeases: number;
}

interface SummaryRow {
  BuildingId: string;
  Name: string;
  Address: string;
  City: string;
  ApartmentCount: number;
  Occupied: number;
}

interface ActivityRow {
  Type: RecentActivityType;
  OccurredAt: Date;
  EntityId: string;
  Label: string;
}

/**
 * SQL Server dashboard read model. Every method is a single, fully
 * aggregated statement — the dashboard costs three round trips total,
 * independent of how many buildings/apartments/leases the tenant has.
 */
export class SqlDashboardRepository implements IDashboardRepository {
  async getCounts(tenantId: string, now: Date, expiringUntil: Date): Promise<DashboardCounts> {
    const [row] = await execQuery<CountsRow>(
      `SELECT
         (SELECT COUNT(*) FROM dbo.Buildings
           WHERE TenantId = @tenantId AND IsDeleted = 0) AS TotalBuildings,
         (SELECT COUNT(*) FROM dbo.Apartments
           WHERE TenantId = @tenantId AND IsDeleted = 0) AS TotalApartments,
         (SELECT COUNT(*) FROM dbo.Occupancies
           WHERE TenantId = @tenantId AND MoveOutDate IS NULL AND IsDeleted = 0) AS OccupiedApartments,
         (SELECT COUNT(*) FROM dbo.Owners
           WHERE TenantId = @tenantId AND IsDeleted = 0) AS TotalOwners,
         (SELECT COUNT(*) FROM dbo.Residents
           WHERE TenantId = @tenantId AND IsDeleted = 0) AS TotalResidents,
         (SELECT COUNT(*) FROM dbo.LeaseContracts
           WHERE TenantId = @tenantId AND Status = 'Active' AND IsDeleted = 0) AS ActiveLeases,
         (SELECT COUNT(*) FROM dbo.LeaseContracts
           WHERE TenantId = @tenantId AND Status = 'Active' AND IsDeleted = 0
             AND EndDate > @now AND EndDate <= @expiringUntil) AS ExpiringLeases`,
      { tenantId, now, expiringUntil },
    );
    return {
      totalBuildings: row.TotalBuildings,
      totalApartments: row.TotalApartments,
      occupiedApartments: row.OccupiedApartments,
      totalOwners: row.TotalOwners,
      totalResidents: row.TotalResidents,
      activeLeases: row.ActiveLeases,
      expiringLeases: row.ExpiringLeases,
    };
  }

  async getBuildingSummaries(tenantId: string): Promise<BuildingOccupancyRow[]> {
    const rows = await execQuery<SummaryRow>(
      `SELECT b.Id AS BuildingId, b.Name, b.Address, b.City,
              COUNT(a.Id) AS ApartmentCount,
              COUNT(o.Id) AS Occupied
       FROM dbo.Buildings b
       LEFT JOIN dbo.Apartments a
         ON a.BuildingId = b.Id AND a.IsDeleted = 0
       LEFT JOIN dbo.Occupancies o
         ON o.ApartmentId = a.Id AND o.MoveOutDate IS NULL AND o.IsDeleted = 0
       WHERE b.TenantId = @tenantId AND b.IsDeleted = 0
       GROUP BY b.Id, b.Name, b.Address, b.City
       ORDER BY b.Name`,
      { tenantId },
    );
    return rows.map((row) => ({
      buildingId: row.BuildingId,
      name: row.Name,
      address: row.Address,
      city: row.City,
      apartmentCount: row.ApartmentCount,
      occupied: row.Occupied,
    }));
  }

  async getRecentActivity(tenantId: string, limit: number): Promise<RecentActivityRow[]> {
    // One UNION ALL over the creation ledger + occupancy history — the
    // activity feed is derived, so it needs no extra writes anywhere.
    const rows = await execQuery<ActivityRow>(
      `SELECT TOP (@limit) Type, OccurredAt, EntityId, Label FROM (
         SELECT 'BuildingCreated' AS Type, b.CreatedAt AS OccurredAt, b.Id AS EntityId,
                b.Name AS Label
         FROM dbo.Buildings b WHERE b.TenantId = @tenantId AND b.IsDeleted = 0
         UNION ALL
         SELECT 'ApartmentAdded', a.CreatedAt, a.Id, a.UnitNumber
         FROM dbo.Apartments a WHERE a.TenantId = @tenantId AND a.IsDeleted = 0
         UNION ALL
         SELECT 'ResidentRegistered', r.CreatedAt, r.Id, r.FullName
         FROM dbo.Residents r WHERE r.TenantId = @tenantId AND r.IsDeleted = 0
         UNION ALL
         SELECT 'LeaseCreated', l.CreatedAt, l.Id, l.ContractNumber
         FROM dbo.LeaseContracts l WHERE l.TenantId = @tenantId AND l.IsDeleted = 0
         UNION ALL
         SELECT 'MoveIn', o.CreatedAt, o.Id, ap.UnitNumber
         FROM dbo.Occupancies o
         JOIN dbo.Apartments ap ON ap.Id = o.ApartmentId
         WHERE o.TenantId = @tenantId AND o.IsDeleted = 0
         UNION ALL
         SELECT 'MoveOut', o.UpdatedAt, o.Id, ap.UnitNumber
         FROM dbo.Occupancies o
         JOIN dbo.Apartments ap ON ap.Id = o.ApartmentId
         WHERE o.TenantId = @tenantId AND o.MoveOutDate IS NOT NULL AND o.IsDeleted = 0
       ) AS Activity
       ORDER BY OccurredAt DESC, EntityId`,
      { tenantId, limit },
    );
    return rows.map((row) => ({
      type: row.Type,
      occurredAt: row.OccurredAt,
      entityId: row.EntityId,
      label: row.Label,
    }));
  }
}
