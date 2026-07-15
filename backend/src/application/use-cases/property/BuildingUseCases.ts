import { Building } from '@domain/business/Building';
import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import {
  IApartmentRepository,
  IBuildingRepository,
} from '@domain/repositories/business/property.repositories';
import {
  BuildingDetailDto,
  BuildingDto,
  CreateBuildingDto,
  UpdateBuildingDto,
} from '@application/dtos/property.dto';
import { toBuildingDetailDto, toBuildingDto } from '@application/mappers/property.mapper';
import { AppError } from '@shared/errors/AppError';
import { PageRequest, PageResult } from '@shared/types';
import { TenantActor } from './context';

const buildingNotFound = (): AppError =>
  AppError.notFound('Building not found', 'BUILDING_NOT_FOUND');

export class CreateBuilding {
  constructor(
    private readonly buildings: IBuildingRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, input: CreateBuildingDto): Promise<BuildingDetailDto> {
    // Business rule: building name is unique per tenant
    if (await this.buildings.existsByName(actor.tenantId, input.name.trim())) {
      throw AppError.conflict('A building with this name already exists', 'BUILDING_NAME_TAKEN');
    }
    const building = Building.create(actor.tenantId, input, actor.userId, this.clock);
    await this.buildings.save(building);
    await this.audit.write({
      userId: actor.userId,
      action: 'BUILDING_CREATED',
      ipAddress: actor.ip ?? null,
      metadata: { buildingId: building.id, name: building.name },
    });
    return toBuildingDetailDto(building);
  }
}

export class UpdateBuilding {
  constructor(
    private readonly buildings: IBuildingRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, id: string, input: UpdateBuildingDto): Promise<BuildingDto> {
    const building = await this.buildings.findById(actor.tenantId, id);
    if (!building) throw buildingNotFound();

    // Renames must not collide with another building of the same tenant
    if (input.name !== undefined && input.name.trim() !== building.name) {
      if (await this.buildings.existsByName(actor.tenantId, input.name.trim())) {
        throw AppError.conflict('A building with this name already exists', 'BUILDING_NAME_TAKEN');
      }
    }

    building.updateDetails(input, actor.userId, this.clock);
    await this.buildings.save(building);
    await this.audit.write({
      userId: actor.userId,
      action: 'BUILDING_UPDATED',
      ipAddress: actor.ip ?? null,
      metadata: { buildingId: building.id },
    });
    return toBuildingDto(building);
  }
}

export class ArchiveBuilding {
  constructor(
    private readonly buildings: IBuildingRepository,
    private readonly apartments: IApartmentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, id: string): Promise<void> {
    const building = await this.buildings.findById(actor.tenantId, id);
    if (!building) throw buildingNotFound();

    // Business rule: a building that still contains apartments cannot be archived
    const counts = await this.apartments.countByStatus(actor.tenantId, id);
    const apartmentCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
    if (apartmentCount > 0) {
      throw AppError.conflict(
        `Building still contains ${apartmentCount} apartment(s) — archive them first`,
        'BUILDING_HAS_APARTMENTS',
      );
    }

    building.softDelete(actor.userId, this.clock.now());
    await this.buildings.remove(building);
    await this.audit.write({
      userId: actor.userId,
      action: 'BUILDING_ARCHIVED',
      ipAddress: actor.ip ?? null,
      metadata: { buildingId: building.id, name: building.name },
    });
  }
}

export class GetBuilding {
  constructor(private readonly buildings: IBuildingRepository) {}

  async execute(actor: TenantActor, id: string): Promise<BuildingDetailDto> {
    const building = await this.buildings.findByIdWithFloors(actor.tenantId, id);
    if (!building) throw buildingNotFound();
    return toBuildingDetailDto(building);
  }
}

export class ListBuildings {
  constructor(private readonly buildings: IBuildingRepository) {}

  async execute(actor: TenantActor, page: PageRequest): Promise<PageResult<BuildingDto>> {
    const result = await this.buildings.listByTenant(actor.tenantId, page);
    return { data: result.data.map(toBuildingDto), pagination: result.pagination };
  }
}
