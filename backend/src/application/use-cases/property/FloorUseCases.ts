import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IBuildingRepository } from '@domain/repositories/business/property.repositories';
import { CreateFloorDto, FloorDto, UpdateFloorDto } from '@application/dtos/property.dto';
import { toFloorDto } from '@application/mappers/property.mapper';
import { AppError } from '@shared/errors/AppError';
import { TenantActor } from './context';

/*
 * Floors are children of the Building aggregate: every operation loads the
 * building (tenant-scoped), mutates through the root, and saves the root —
 * that is what enforces per-building floor-number uniqueness atomically.
 */

const buildingNotFound = (): AppError =>
  AppError.notFound('Building not found', 'BUILDING_NOT_FOUND');

export class AddFloor {
  constructor(
    private readonly buildings: IBuildingRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, buildingId: string, input: CreateFloorDto): Promise<FloorDto> {
    const building = await this.buildings.findByIdWithFloors(actor.tenantId, buildingId);
    if (!building) throw buildingNotFound();

    // Business rule: floor numbers are unique inside a building (pre-check → 409;
    // the aggregate re-enforces the same invariant as the last line of defense)
    if (building.floors.some((f) => f.floorNumber === input.floorNumber && !f.isDeleted)) {
      throw AppError.conflict(
        `Floor ${input.floorNumber} already exists in this building`,
        'FLOOR_NUMBER_TAKEN',
      );
    }

    const floor = building.addFloor(
      input.floorNumber,
      input.name ?? null,
      actor.userId,
      this.clock,
    );
    await this.buildings.save(building);
    await this.audit.write({
      userId: actor.userId,
      action: 'FLOOR_ADDED',
      ipAddress: actor.ip ?? null,
      metadata: { buildingId, floorId: floor.id, floorNumber: floor.floorNumber },
    });
    return toFloorDto(floor);
  }
}

export class UpdateFloor {
  constructor(
    private readonly buildings: IBuildingRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(
    actor: TenantActor,
    buildingId: string,
    floorId: string,
    input: UpdateFloorDto,
  ): Promise<FloorDto> {
    const building = await this.buildings.findByIdWithFloors(actor.tenantId, buildingId);
    if (!building) throw buildingNotFound();

    const floor = building.floors.find((f) => f.id === floorId && !f.isDeleted);
    if (!floor) throw AppError.notFound('Floor not found', 'FLOOR_NOT_FOUND');

    floor.rename(input.name, actor.userId, this.clock);
    await this.buildings.save(building);
    await this.audit.write({
      userId: actor.userId,
      action: 'FLOOR_UPDATED',
      ipAddress: actor.ip ?? null,
      metadata: { buildingId, floorId },
    });
    return toFloorDto(floor);
  }
}

export class ListFloors {
  constructor(private readonly buildings: IBuildingRepository) {}

  async execute(actor: TenantActor, buildingId: string): Promise<FloorDto[]> {
    const building = await this.buildings.findByIdWithFloors(actor.tenantId, buildingId);
    if (!building) throw buildingNotFound();
    return building.floors
      .filter((f) => !f.isDeleted)
      .sort((a, b) => a.floorNumber - b.floorNumber)
      .map(toFloorDto);
  }
}
