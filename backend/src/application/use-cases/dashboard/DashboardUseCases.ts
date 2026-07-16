import { IClock } from '@domain/common/time/IClock';
import {
  IDashboardRepository,
  RecentActivityType,
} from '@domain/repositories/business/dashboard.repositories';
import { ILeaseContractRepository } from '@domain/repositories/business/leasing.repositories';
import {
  BuildingSummaryDto,
  DashboardSummaryDto,
  LeaseAlertsDto,
  RecentActivityDto,
} from '@application/dtos/dashboard.dto';
import { toLeaseContractDto } from '@application/mappers/leasing.mapper';
import { TenantActor } from '@application/use-cases/property/context';

/*
 * Report services (Sprint 6). All dashboard statistics are computed HERE —
 * controllers only translate HTTP. The repository contract guarantees
 * aggregated queries, so a dashboard render costs a fixed, small number of
 * round trips regardless of portfolio size.
 */

const EXPIRING_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export class GetDashboardSummary {
  constructor(
    private readonly dashboard: IDashboardRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor): Promise<DashboardSummaryDto> {
    const now = this.clock.now();
    const expiringUntil = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY_MS);
    const counts = await this.dashboard.getCounts(actor.tenantId, now, expiringUntil);

    const vacantApartments = counts.totalApartments - counts.occupiedApartments;
    return {
      totalBuildings: counts.totalBuildings,
      totalApartments: counts.totalApartments,
      occupiedApartments: counts.occupiedApartments,
      vacantApartments,
      totalOwners: counts.totalOwners,
      totalResidents: counts.totalResidents,
      activeLeases: counts.activeLeases,
      expiringLeases: counts.expiringLeases,
      openMaintenanceRequests: 0, // Maintenance module arrives in a later sprint
      occupancyRate:
        counts.totalApartments === 0
          ? 0
          : Math.round((counts.occupiedApartments / counts.totalApartments) * 100),
      asOf: now.toISOString(),
    };
  }
}

export class GetBuildingSummaries {
  constructor(private readonly dashboard: IDashboardRepository) {}

  async execute(actor: TenantActor): Promise<BuildingSummaryDto[]> {
    const rows = await this.dashboard.getBuildingSummaries(actor.tenantId);
    return rows.map((row) => ({
      buildingId: row.buildingId,
      name: row.name,
      address: row.address,
      city: row.city,
      apartmentCount: row.apartmentCount,
      occupied: row.occupied,
      vacant: row.apartmentCount - row.occupied,
      occupancyPercent:
        row.apartmentCount === 0 ? 0 : Math.round((row.occupied / row.apartmentCount) * 100),
    }));
  }
}

export class GetLeaseAlerts {
  constructor(
    private readonly leases: ILeaseContractRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor): Promise<LeaseAlertsDto> {
    const now = this.clock.now();
    const until = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY_MS);

    const [expiringSoon, expired] = await Promise.all([
      this.leases.listActiveEndingBetween(actor.tenantId, now, until),
      this.leases.listExpired(actor.tenantId, now),
    ]);

    return {
      expiringSoon: expiringSoon
        .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())
        .map(toLeaseContractDto),
      expired: expired
        .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
        .map(toLeaseContractDto),
    };
  }
}

const ACTIVITY_DESCRIPTIONS: Record<RecentActivityType, (label: string) => string> = {
  BuildingCreated: (label) => `Building "${label}" created`,
  ApartmentAdded: (label) => `Apartment ${label} added`,
  ResidentRegistered: (label) => `Resident ${label} registered`,
  LeaseCreated: (label) => `Lease ${label} created`,
  MoveIn: (label) => `Move-in — unit ${label}`,
  MoveOut: (label) => `Move-out — unit ${label}`,
};

export class GetRecentActivity {
  constructor(private readonly dashboard: IDashboardRepository) {}

  async execute(actor: TenantActor, limit: number): Promise<RecentActivityDto[]> {
    const rows = await this.dashboard.getRecentActivity(actor.tenantId, limit);
    return rows.map((row) => ({
      type: row.type,
      occurredAt: row.occurredAt.toISOString(),
      entityId: row.entityId,
      description: ACTIVITY_DESCRIPTIONS[row.type](row.label),
    }));
  }
}
