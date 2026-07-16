import { LeaseContract, PaymentFrequency } from '@domain/business/LeaseContract';
import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import {
  ILeaseContractRepository,
  LeaseListQuery,
} from '@domain/repositories/business/leasing.repositories';
import { IOccupancyRepository } from '@domain/repositories/business/occupancy.repositories';
import {
  IApartmentRepository,
  IResidentRepository,
} from '@domain/repositories/business/property.repositories';
import { CreateLeaseDto, TerminateLeaseDto, UpdateLeaseDto } from '@application/dtos/occupancy.dto';
import { LeaseContractDto } from '@application/dtos/leasing.dto';
import { toLeaseContractDto } from '@application/mappers/leasing.mapper';
import { TenantActor } from '@application/use-cases/property/context';
import { AppError } from '@shared/errors/AppError';
import { CursorResult } from '@shared/types';

const leaseNotFound = (): AppError => AppError.notFound('Lease not found', 'LEASE_NOT_FOUND');

/** LC-2026-483920 style contract numbers (retries on the rare collision). */
const generateContractNumber = (year: number): string =>
  `LC-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

export class CreateLease {
  constructor(
    private readonly leases: ILeaseContractRepository,
    private readonly apartments: IApartmentRepository,
    private readonly residents: IResidentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, input: CreateLeaseDto): Promise<LeaseContractDto> {
    const apartment = await this.apartments.findById(actor.tenantId, input.apartmentId);
    if (!apartment) throw AppError.notFound('Apartment not found', 'APARTMENT_NOT_FOUND');
    const resident = await this.residents.findById(actor.tenantId, input.residentId);
    if (!resident) throw AppError.notFound('Resident not found', 'RESIDENT_NOT_FOUND');

    // The lessor is the apartment's owner — a lease needs one on record
    if (!apartment.ownerId) {
      throw AppError.conflict(
        'The apartment has no owner on record — assign an owner first',
        'APARTMENT_HAS_NO_OWNER',
      );
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    // Business rule: one active lease per apartment
    if (await this.leases.findActiveByApartment(actor.tenantId, input.apartmentId)) {
      throw AppError.conflict(
        'The apartment already has an active lease',
        'APARTMENT_HAS_ACTIVE_LEASE',
      );
    }
    // Business rule: a resident cannot have multiple active leases
    if (await this.leases.findActiveByResident(actor.tenantId, input.residentId)) {
      throw AppError.conflict(
        'The resident already has an active lease',
        'RESIDENT_HAS_ACTIVE_LEASE',
      );
    }
    // Business rule: lease dates cannot overlap for the same apartment
    if (
      await this.leases.existsOverlapping(actor.tenantId, input.apartmentId, startDate, endDate)
    ) {
      throw AppError.conflict(
        'The apartment has another lease overlapping these dates',
        'LEASE_DATES_OVERLAP',
      );
    }

    const contractNumber = await this.resolveContractNumber(actor.tenantId, input.contractNumber);

    const lease = LeaseContract.draft(
      actor.tenantId,
      {
        contractNumber,
        apartmentId: input.apartmentId,
        ownerId: apartment.ownerId,
        residentId: input.residentId,
        startDate,
        endDate,
        monthlyRent: input.monthlyRent,
        currency: input.currency,
        depositAmount: input.depositAmount,
        paymentFrequency: input.paymentFrequency as PaymentFrequency | undefined,
        lateFeePercent: input.lateFeePercent,
        graceDays: input.graceDays,
      },
      actor.userId,
      this.clock,
    );
    // Created contracts take effect immediately (guards above ran first)
    lease.activate(actor.userId, this.clock);
    await this.leases.save(lease);
    await this.audit.write({
      userId: actor.userId,
      action: 'LEASE_CREATED',
      ipAddress: actor.ip ?? null,
      metadata: { leaseId: lease.id, contractNumber, apartmentId: input.apartmentId },
    });
    return toLeaseContractDto(lease);
  }

  private async resolveContractNumber(tenantId: string, requested?: string): Promise<string> {
    if (requested) {
      if (await this.leases.existsByContractNumber(tenantId, requested.trim())) {
        throw AppError.conflict('Contract number already exists', 'CONTRACT_NUMBER_TAKEN');
      }
      return requested.trim();
    }
    const year = this.clock.now().getUTCFullYear();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateContractNumber(year);
      if (!(await this.leases.existsByContractNumber(tenantId, candidate))) return candidate;
    }
    throw AppError.internal('Could not allocate a contract number', 'CONTRACT_NUMBER_EXHAUSTED');
  }
}

export class UpdateLease {
  constructor(
    private readonly leases: ILeaseContractRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  /** Extension in place: the only mutable term of a signed lease. */
  async execute(actor: TenantActor, id: string, input: UpdateLeaseDto): Promise<LeaseContractDto> {
    const lease = await this.leases.findById(actor.tenantId, id);
    if (!lease) throw leaseNotFound();

    const newEndDate = new Date(input.endDate);
    if (
      await this.leases.existsOverlapping(
        actor.tenantId,
        lease.apartmentId,
        lease.startDate,
        newEndDate,
        lease.id,
      )
    ) {
      throw AppError.conflict(
        'The extension overlaps another lease of this apartment',
        'LEASE_DATES_OVERLAP',
      );
    }

    lease.extend(newEndDate, actor.userId, this.clock);
    await this.leases.save(lease);
    await this.audit.write({
      userId: actor.userId,
      action: 'LEASE_UPDATED',
      ipAddress: actor.ip ?? null,
      metadata: { leaseId: lease.id, endDate: input.endDate },
    });
    return toLeaseContractDto(lease);
  }
}

export class TerminateLease {
  constructor(
    private readonly leases: ILeaseContractRepository,
    private readonly occupancies: IOccupancyRepository,
    private readonly residents: IResidentRepository,
    private readonly apartments: IApartmentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(
    actor: TenantActor,
    id: string,
    input: TerminateLeaseDto,
  ): Promise<LeaseContractDto> {
    const lease = await this.leases.findById(actor.tenantId, id);
    if (!lease) throw leaseNotFound();

    lease.terminate(input.reason, actor.userId, this.clock); // Active → Terminated (domain-guarded)

    // Business rule: terminating a lease automatically ends its occupancy
    const occupancy = await this.occupancies.findActiveByLease(actor.tenantId, lease.id);
    if (occupancy) {
      const moveOutDate = this.clock.now();
      occupancy.close(moveOutDate, `Lease terminated: ${input.reason}`, actor.userId, this.clock);
      await this.occupancies.save(occupancy);

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
    }

    await this.leases.save(lease);
    await this.audit.write({
      userId: actor.userId,
      action: 'LEASE_TERMINATED',
      ipAddress: actor.ip ?? null,
      metadata: { leaseId: lease.id, reason: input.reason, closedOccupancy: occupancy?.id ?? null },
    });
    return toLeaseContractDto(lease);
  }
}

export class GetLease {
  constructor(private readonly leases: ILeaseContractRepository) {}

  async execute(actor: TenantActor, id: string): Promise<LeaseContractDto> {
    const lease = await this.leases.findById(actor.tenantId, id);
    if (!lease) throw leaseNotFound();
    return toLeaseContractDto(lease);
  }
}

export class ListLeases {
  constructor(private readonly leases: ILeaseContractRepository) {}

  async execute(
    actor: TenantActor,
    query: LeaseListQuery,
  ): Promise<CursorResult<LeaseContractDto>> {
    const result = await this.leases.listCursor(actor.tenantId, query);
    return {
      data: result.data.map(toLeaseContractDto),
      nextCursor: result.nextCursor,
      limit: result.limit,
    };
  }
}
