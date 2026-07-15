import { Apartment, ApartmentProps } from '@domain/business/Apartment';
import { Building, BuildingProps, Floor, FloorProps } from '@domain/business/Building';
import { Owner, OwnerProps } from '@domain/business/Owner';
import {
  IApartmentRepository,
  IBuildingRepository,
  IOwnerRepository,
} from '@domain/repositories/business/property.repositories';
import { PageRequest, PageResult } from '@shared/types';

/*
 * In-memory implementations of the property repository contracts.
 *
 * State is stored as plain props (like database rows) and aggregates are
 * rehydrated per call via `restore` — no live entity instances are shared
 * between calls, mirroring how the SQL implementations behave. The
 * repository contract tests (property.repositories.test.ts) run against
 * these; the SQL implementations satisfy the same contract against a
 * real database.
 */

const paginate = <TProps, TAgg>(
  rows: TProps[],
  page: PageRequest,
  restore: (props: TProps) => TAgg,
): PageResult<TAgg> => {
  const start = (page.page - 1) * page.pageSize;
  return {
    data: rows.slice(start, start + page.pageSize).map(restore),
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      totalCount: rows.length,
      totalPages: Math.ceil(rows.length / page.pageSize),
    },
  };
};

export class InMemoryBuildingRepository implements IBuildingRepository {
  buildings = new Map<string, BuildingProps>();
  floors = new Map<string, FloorProps>();

  private alive(tenantId: string): BuildingProps[] {
    return [...this.buildings.values()].filter((b) => b.tenantId === tenantId && !b.isDeleted);
  }

  private floorsOf(buildingId: string): Floor[] {
    return [...this.floors.values()]
      .filter((f) => f.buildingId === buildingId)
      .map((f) => Floor.restore({ ...f }));
  }

  async findById(tenantId: string, id: string): Promise<Building | null> {
    const props = this.buildings.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return Building.restore({ ...props });
  }

  async findByIdWithFloors(tenantId: string, id: string): Promise<Building | null> {
    const props = this.buildings.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return Building.restore({ ...props }, this.floorsOf(id));
  }

  async existsByName(tenantId: string, name: string): Promise<boolean> {
    return this.alive(tenantId).some((b) => b.name === name);
  }

  async listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<Building>> {
    const rows = this.alive(tenantId).sort((a, b) => a.name.localeCompare(b.name));
    return paginate(rows, page, (props) => Building.restore({ ...props }));
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Building>> {
    return this.listByTenant(tenantId, page);
  }

  async save(building: Building): Promise<void> {
    this.buildings.set(building.id, building.toProps());
    for (const floor of building.floors) {
      this.floors.set(floor.id, floor.toProps());
    }
  }

  async remove(building: Building): Promise<void> {
    this.buildings.set(building.id, building.toProps());
  }
}

export class InMemoryApartmentRepository implements IApartmentRepository {
  apartments = new Map<string, ApartmentProps>();

  private alive(tenantId: string): ApartmentProps[] {
    return [...this.apartments.values()].filter((a) => a.tenantId === tenantId && !a.isDeleted);
  }

  async findById(tenantId: string, id: string): Promise<Apartment | null> {
    const props = this.apartments.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return Apartment.restore({ ...props });
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Apartment>> {
    const rows = this.alive(tenantId).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
    return paginate(rows, page, (props) => Apartment.restore({ ...props }));
  }

  async listByBuilding(
    tenantId: string,
    buildingId: string,
    page: PageRequest,
  ): Promise<PageResult<Apartment>> {
    const rows = this.alive(tenantId)
      .filter((a) => a.buildingId === buildingId)
      .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
    return paginate(rows, page, (props) => Apartment.restore({ ...props }));
  }

  async existsByUnitNumber(
    tenantId: string,
    buildingId: string,
    unitNumber: string,
  ): Promise<boolean> {
    return this.alive(tenantId).some(
      (a) => a.buildingId === buildingId && a.unitNumber === unitNumber,
    );
  }

  async countByStatus(tenantId: string, buildingId: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const a of this.alive(tenantId)) {
      if (a.buildingId !== buildingId) continue;
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }

  async save(apartment: Apartment): Promise<void> {
    this.apartments.set(apartment.id, apartment.toProps());
  }

  async remove(apartment: Apartment): Promise<void> {
    this.apartments.set(apartment.id, apartment.toProps());
  }
}

export class InMemoryOwnerRepository implements IOwnerRepository {
  owners = new Map<string, OwnerProps>();

  private alive(tenantId: string): OwnerProps[] {
    return [...this.owners.values()].filter((o) => o.tenantId === tenantId && !o.isDeleted);
  }

  async findById(tenantId: string, id: string): Promise<Owner | null> {
    const props = this.owners.get(id);
    if (!props || props.tenantId !== tenantId || props.isDeleted) return null;
    return Owner.restore({ ...props });
  }

  async findByUserId(tenantId: string, userId: string): Promise<Owner | null> {
    const props = this.alive(tenantId).find((o) => o.userId === userId);
    return props ? Owner.restore({ ...props }) : null;
  }

  async listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<Owner>> {
    const rows = this.alive(tenantId).sort((a, b) => a.fullName.localeCompare(b.fullName));
    return paginate(rows, page, (props) => Owner.restore({ ...props }));
  }

  async findPage(tenantId: string, page: PageRequest): Promise<PageResult<Owner>> {
    return this.listByTenant(tenantId, page);
  }

  async save(owner: Owner): Promise<void> {
    this.owners.set(owner.id, owner.toProps());
  }

  async remove(owner: Owner): Promise<void> {
    this.owners.set(owner.id, owner.toProps());
  }
}
