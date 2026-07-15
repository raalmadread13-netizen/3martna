import { Apartment, ApartmentStatus } from '@domain/business/Apartment';
import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import {
  IApartmentRepository,
  IBuildingRepository,
  IOwnerRepository,
} from '@domain/repositories/business/property.repositories';
import {
  ApartmentDto,
  CreateApartmentDto,
  UpdateApartmentDto,
} from '@application/dtos/property.dto';
import { toApartmentDto } from '@application/mappers/property.mapper';
import { AppError } from '@shared/errors/AppError';
import { PageRequest, PageResult } from '@shared/types';
import { TenantActor } from './context';

const apartmentNotFound = (): AppError =>
  AppError.notFound('Apartment not found', 'APARTMENT_NOT_FOUND');

export class CreateApartment {
  constructor(
    private readonly apartments: IApartmentRepository,
    private readonly buildings: IBuildingRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, input: CreateApartmentDto): Promise<ApartmentDto> {
    // The building must exist within the caller's tenant …
    const building = await this.buildings.findByIdWithFloors(actor.tenantId, input.buildingId);
    if (!building) throw AppError.notFound('Building not found', 'BUILDING_NOT_FOUND');

    // … and the floor must belong to that building
    const floor = building.floors.find((f) => f.id === input.floorId && !f.isDeleted);
    if (!floor) throw AppError.notFound('Floor not found in this building', 'FLOOR_NOT_FOUND');

    // Business rule: unit number is unique inside a building
    if (
      await this.apartments.existsByUnitNumber(
        actor.tenantId,
        input.buildingId,
        input.unitNumber.trim(),
      )
    ) {
      throw AppError.conflict(
        'An apartment with this unit number already exists in the building',
        'UNIT_NUMBER_TAKEN',
      );
    }

    const apartment = Apartment.create(actor.tenantId, input, actor.userId, this.clock);
    await this.apartments.save(apartment);
    await this.audit.write({
      userId: actor.userId,
      action: 'APARTMENT_CREATED',
      ipAddress: actor.ip ?? null,
      metadata: { apartmentId: apartment.id, buildingId: input.buildingId },
    });
    return toApartmentDto(apartment);
  }
}

export class UpdateApartment {
  constructor(
    private readonly apartments: IApartmentRepository,
    private readonly owners: IOwnerRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, id: string, input: UpdateApartmentDto): Promise<ApartmentDto> {
    const apartment = await this.apartments.findById(actor.tenantId, id);
    if (!apartment) throw apartmentNotFound();

    apartment.updateDetails(
      {
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqm: input.areaSqm,
        baseRentAmount: input.baseRentAmount,
        description: input.description,
      },
      actor.userId,
      this.clock,
    );

    // Owner must exist in the same tenant before being assigned
    if (input.ownerId !== undefined && input.ownerId !== apartment.ownerId) {
      const owner = await this.owners.findById(actor.tenantId, input.ownerId);
      if (!owner) throw AppError.notFound('Owner not found', 'OWNER_NOT_FOUND');
      apartment.assignOwner(owner.id, actor.userId, this.clock);
    }

    // Status changes go through the domain state machine (invalid → 422)
    if (input.status !== undefined && input.status !== apartment.status) {
      this.transition(apartment, input.status as ApartmentStatus, actor);
    }

    await this.apartments.save(apartment);
    await this.audit.write({
      userId: actor.userId,
      action: 'APARTMENT_UPDATED',
      ipAddress: actor.ip ?? null,
      metadata: { apartmentId: apartment.id },
    });
    return toApartmentDto(apartment);
  }

  private transition(apartment: Apartment, status: ApartmentStatus, actor: TenantActor): void {
    switch (status) {
      case 'Available':
        apartment.markAvailable(actor.userId, this.clock);
        break;
      case 'Leased':
        apartment.markLeased(actor.userId, this.clock);
        break;
      case 'OwnerOccupied':
        apartment.markOwnerOccupied(actor.userId, this.clock);
        break;
      case 'UnderMaintenance':
        apartment.markUnderMaintenance(actor.userId, this.clock);
        break;
      case 'Reserved':
        apartment.reserve(actor.userId, this.clock);
        break;
    }
  }
}

export class ArchiveApartment {
  constructor(
    private readonly apartments: IApartmentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, id: string): Promise<void> {
    const apartment = await this.apartments.findById(actor.tenantId, id);
    if (!apartment) throw apartmentNotFound();

    apartment.softDelete(actor.userId, this.clock.now());
    await this.apartments.remove(apartment);
    await this.audit.write({
      userId: actor.userId,
      action: 'APARTMENT_ARCHIVED',
      ipAddress: actor.ip ?? null,
      metadata: { apartmentId: apartment.id, unitNumber: apartment.unitNumber },
    });
  }
}

export class GetApartment {
  constructor(private readonly apartments: IApartmentRepository) {}

  async execute(actor: TenantActor, id: string): Promise<ApartmentDto> {
    const apartment = await this.apartments.findById(actor.tenantId, id);
    if (!apartment) throw apartmentNotFound();
    return toApartmentDto(apartment);
  }
}

export class ListApartments {
  constructor(private readonly apartments: IApartmentRepository) {}

  async execute(
    actor: TenantActor,
    page: PageRequest,
    buildingId?: string,
  ): Promise<PageResult<ApartmentDto>> {
    const result = buildingId
      ? await this.apartments.listByBuilding(actor.tenantId, buildingId, page)
      : await this.apartments.findPage(actor.tenantId, page);
    return { data: result.data.map(toApartmentDto), pagination: result.pagination };
  }
}
