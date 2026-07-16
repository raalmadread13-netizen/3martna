import {
  BuildingOccupancyRow,
  DashboardCounts,
  IDashboardRepository,
  RecentActivityRow,
} from '@domain/repositories/business/dashboard.repositories';
import {
  InMemoryLeaseContractRepository,
  InMemoryOccupancyRepository,
  InMemoryResidentRepository,
} from './fakes.occupancy';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from './fakes.property';

/**
 * In-memory dashboard read model: derives every aggregate from the other
 * in-memory repositories' state, mirroring exactly what the SQL
 * implementation computes with aggregated queries.
 */
export class InMemoryDashboardRepository implements IDashboardRepository {
  constructor(
    private readonly buildings: InMemoryBuildingRepository,
    private readonly apartments: InMemoryApartmentRepository,
    private readonly owners: InMemoryOwnerRepository,
    private readonly residents: InMemoryResidentRepository,
    private readonly leases: InMemoryLeaseContractRepository,
    private readonly occupancies: InMemoryOccupancyRepository,
  ) {}

  async getCounts(tenantId: string, now: Date, expiringUntil: Date): Promise<DashboardCounts> {
    const alive = <T extends { tenantId: string; isDeleted: boolean }>(rows: Iterable<T>): T[] =>
      [...rows].filter((r) => r.tenantId === tenantId && !r.isDeleted);

    const leaseRows = alive(this.leases.leases.values());
    return {
      totalBuildings: alive(this.buildings.buildings.values()).length,
      totalApartments: alive(this.apartments.apartments.values()).length,
      occupiedApartments: alive(this.occupancies.occupancies.values()).filter(
        (o) => o.moveOutDate === null,
      ).length,
      totalOwners: alive(this.owners.owners.values()).length,
      totalResidents: alive(this.residents.residents.values()).length,
      activeLeases: leaseRows.filter((l) => l.status === 'Active').length,
      expiringLeases: leaseRows.filter(
        (l) =>
          l.status === 'Active' &&
          l.endDate.getTime() > now.getTime() &&
          l.endDate.getTime() <= expiringUntil.getTime(),
      ).length,
    };
  }

  async getBuildingSummaries(tenantId: string): Promise<BuildingOccupancyRow[]> {
    const buildings = [...this.buildings.buildings.values()]
      .filter((b) => b.tenantId === tenantId && !b.isDeleted)
      .sort((a, b) => a.name.localeCompare(b.name));
    const apartments = [...this.apartments.apartments.values()].filter(
      (a) => a.tenantId === tenantId && !a.isDeleted,
    );
    const activeStays = [...this.occupancies.occupancies.values()].filter(
      (o) => o.tenantId === tenantId && !o.isDeleted && o.moveOutDate === null,
    );
    const occupiedApartmentIds = new Set(activeStays.map((o) => o.apartmentId));

    return buildings.map((building) => {
      const units = apartments.filter((a) => a.buildingId === building.id);
      return {
        buildingId: building.id,
        name: building.name,
        address: building.address,
        city: building.city,
        apartmentCount: units.length,
        occupied: units.filter((a) => occupiedApartmentIds.has(a.id)).length,
      };
    });
  }

  async getRecentActivity(tenantId: string, limit: number): Promise<RecentActivityRow[]> {
    const rows: RecentActivityRow[] = [];
    const unitNumberOf = (apartmentId: string): string =>
      this.apartments.apartments.get(apartmentId)?.unitNumber ?? '?';

    for (const b of this.buildings.buildings.values()) {
      if (b.tenantId !== tenantId || b.isDeleted) continue;
      rows.push({
        type: 'BuildingCreated',
        occurredAt: b.createdAt,
        entityId: b.id,
        label: b.name,
      });
    }
    for (const a of this.apartments.apartments.values()) {
      if (a.tenantId !== tenantId || a.isDeleted) continue;
      rows.push({
        type: 'ApartmentAdded',
        occurredAt: a.createdAt,
        entityId: a.id,
        label: a.unitNumber,
      });
    }
    for (const r of this.residents.residents.values()) {
      if (r.tenantId !== tenantId || r.isDeleted) continue;
      rows.push({
        type: 'ResidentRegistered',
        occurredAt: r.createdAt,
        entityId: r.id,
        label: r.fullName,
      });
    }
    for (const l of this.leases.leases.values()) {
      if (l.tenantId !== tenantId || l.isDeleted) continue;
      rows.push({
        type: 'LeaseCreated',
        occurredAt: l.createdAt,
        entityId: l.id,
        label: l.contractNumber,
      });
    }
    for (const o of this.occupancies.occupancies.values()) {
      if (o.tenantId !== tenantId || o.isDeleted) continue;
      rows.push({
        type: 'MoveIn',
        occurredAt: o.createdAt,
        entityId: o.id,
        label: unitNumberOf(o.apartmentId),
      });
      if (o.moveOutDate !== null) {
        rows.push({
          type: 'MoveOut',
          occurredAt: o.updatedAt,
          entityId: o.id,
          label: unitNumberOf(o.apartmentId),
        });
      }
    }

    return rows
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() || a.entityId.localeCompare(b.entityId),
      )
      .slice(0, limit);
  }
}
