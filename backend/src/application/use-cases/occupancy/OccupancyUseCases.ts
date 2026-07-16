import { Occupancy } from '@domain/business/Occupancy';
import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { ILeaseContractRepository } from '@domain/repositories/business/leasing.repositories';
import {
  IOccupancyRepository,
  OccupancyListQuery,
} from '@domain/repositories/business/occupancy.repositories';
import {
  IApartmentRepository,
  IResidentRepository,
} from '@domain/repositories/business/property.repositories';
import { MoveInDto, MoveOutDto, OccupancyDto } from '@application/dtos/occupancy.dto';
import { toOccupancyDto } from '@application/mappers/occupancy.mapper';
import { TenantActor } from '@application/use-cases/property/context';
import { AppError } from '@shared/errors/AppError';
import { CursorResult } from '@shared/types';

const occupancyNotFound = (): AppError =>
  AppError.notFound('Occupancy record not found', 'OCCUPANCY_NOT_FOUND');

/**
 * Move-In: the workflow that turns an active lease into an occupied
 * apartment. Everything is checked here — this is a business operation,
 * not CRUD.
 */
export class MoveIn {
  constructor(
    private readonly occupancies: IOccupancyRepository,
    private readonly leases: ILeaseContractRepository,
    private readonly residents: IResidentRepository,
    private readonly apartments: IApartmentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, input: MoveInDto): Promise<OccupancyDto> {
    const lease = await this.leases.findById(actor.tenantId, input.leaseId);
    if (!lease) throw AppError.notFound('Lease not found', 'LEASE_NOT_FOUND');

    // Business rule: move-in requires an ACTIVE lease
    if (lease.status !== 'Active') {
      throw AppError.conflict(
        `Move-in requires an active lease (current status: ${lease.status})`,
        'MOVE_IN_REQUIRES_ACTIVE_LEASE',
      );
    }

    const moveInDate = input.moveInDate ? new Date(input.moveInDate) : lease.startDate;
    if (!lease.period.contains(moveInDate)) {
      throw new AppError(
        422,
        'Move-in date must fall inside the lease period',
        'MOVE_IN_OUTSIDE_LEASE',
      );
    }

    // Business rule: one active occupancy per apartment…
    if (await this.occupancies.findActiveByApartment(actor.tenantId, lease.apartmentId)) {
      throw AppError.conflict('The apartment is already occupied', 'APARTMENT_ALREADY_OCCUPIED');
    }
    // …and per resident
    if (await this.occupancies.findActiveByResident(actor.tenantId, lease.residentId)) {
      throw AppError.conflict(
        'The resident already occupies an apartment',
        'RESIDENT_ALREADY_MOVED_IN',
      );
    }

    const resident = await this.residents.findById(actor.tenantId, lease.residentId);
    if (!resident) throw AppError.notFound('Resident not found', 'RESIDENT_NOT_FOUND');
    const apartment = await this.apartments.findById(actor.tenantId, lease.apartmentId);
    if (!apartment) throw AppError.notFound('Apartment not found', 'APARTMENT_NOT_FOUND');

    const occupancy = Occupancy.open(
      actor.tenantId,
      {
        apartmentId: lease.apartmentId,
        residentId: lease.residentId,
        leaseContractId: lease.id,
        moveInDate,
      },
      actor.userId,
      this.clock,
    );
    resident.occupy(lease.apartmentId, moveInDate, actor.userId, this.clock);
    if (apartment.status === 'Available' || apartment.status === 'Reserved') {
      apartment.markLeased(actor.userId, this.clock);
    } else if (apartment.status !== 'Leased') {
      throw AppError.conflict(
        `The apartment is not available for move-in (status: ${apartment.status})`,
        'APARTMENT_NOT_AVAILABLE',
      );
    }

    await this.occupancies.save(occupancy);
    await this.residents.save(resident);
    await this.apartments.save(apartment);
    await this.audit.write({
      userId: actor.userId,
      action: 'MOVE_IN',
      ipAddress: actor.ip ?? null,
      metadata: {
        occupancyId: occupancy.id,
        leaseId: lease.id,
        apartmentId: lease.apartmentId,
        residentId: lease.residentId,
      },
    });
    return toOccupancyDto(occupancy);
  }
}

/**
 * Move-Out: closes the stay. The occupancy row is preserved forever —
 * history is the point of this table. The lease itself stays untouched
 * (it may run to its end date or be terminated separately).
 */
export class MoveOut {
  constructor(
    private readonly occupancies: IOccupancyRepository,
    private readonly residents: IResidentRepository,
    private readonly apartments: IApartmentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, occupancyId: string, input: MoveOutDto): Promise<OccupancyDto> {
    const occupancy = await this.occupancies.findById(actor.tenantId, occupancyId);
    if (!occupancy) throw occupancyNotFound();
    if (!occupancy.isActive) {
      throw AppError.conflict('The occupancy is already closed', 'OCCUPANCY_ALREADY_CLOSED');
    }

    const moveOutDate = input.moveOutDate ? new Date(input.moveOutDate) : this.clock.now();
    occupancy.close(moveOutDate, input.reason ?? null, actor.userId, this.clock);

    const resident = await this.residents.findById(actor.tenantId, occupancy.residentId);
    if (resident?.isActive && resident.apartmentId === occupancy.apartmentId) {
      resident.moveOut(moveOutDate, actor.userId, this.clock);
      await this.residents.save(resident);
    }
    const apartment = await this.apartments.findById(actor.tenantId, occupancy.apartmentId);
    if (apartment?.status === 'Leased') {
      apartment.markAvailable(actor.userId, this.clock);
      await this.apartments.save(apartment);
    }

    await this.occupancies.save(occupancy);
    await this.audit.write({
      userId: actor.userId,
      action: 'MOVE_OUT',
      ipAddress: actor.ip ?? null,
      metadata: {
        occupancyId: occupancy.id,
        apartmentId: occupancy.apartmentId,
        residentId: occupancy.residentId,
        reason: input.reason ?? null,
      },
    });
    return toOccupancyDto(occupancy);
  }
}

export class GetOccupancy {
  constructor(private readonly occupancies: IOccupancyRepository) {}

  async execute(actor: TenantActor, id: string): Promise<OccupancyDto> {
    const occupancy = await this.occupancies.findById(actor.tenantId, id);
    if (!occupancy) throw occupancyNotFound();
    return toOccupancyDto(occupancy);
  }
}

export class ListOccupancyHistory {
  constructor(private readonly occupancies: IOccupancyRepository) {}

  async execute(
    actor: TenantActor,
    query: OccupancyListQuery,
  ): Promise<CursorResult<OccupancyDto>> {
    const result = await this.occupancies.listCursor(actor.tenantId, query);
    return {
      data: result.data.map(toOccupancyDto),
      nextCursor: result.nextCursor,
      limit: result.limit,
    };
  }
}
