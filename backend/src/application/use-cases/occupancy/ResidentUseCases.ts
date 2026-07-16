import { Resident, ResidencyType } from '@domain/business/Resident';
import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import {
  IResidentRepository,
  ResidentListQuery,
} from '@domain/repositories/business/property.repositories';
import { CreateResidentDto, UpdateResidentDto } from '@application/dtos/occupancy.dto';
import { ResidentDto } from '@application/dtos/property.dto';
import { toResidentDto } from '@application/mappers/property.mapper';
import { TenantActor } from '@application/use-cases/property/context';
import { AppError } from '@shared/errors/AppError';
import { CursorResult } from '@shared/types';

const residentNotFound = (): AppError =>
  AppError.notFound('Resident not found', 'RESIDENT_NOT_FOUND');

export class RegisterResident {
  constructor(
    private readonly residents: IResidentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, input: CreateResidentDto): Promise<ResidentDto> {
    const resident = Resident.register(
      actor.tenantId,
      { ...input, residencyType: input.residencyType as ResidencyType | undefined },
      actor.userId,
      this.clock,
    );
    await this.residents.save(resident);
    await this.audit.write({
      userId: actor.userId,
      action: 'RESIDENT_REGISTERED',
      ipAddress: actor.ip ?? null,
      metadata: { residentId: resident.id, fullName: resident.fullName },
    });
    return toResidentDto(resident);
  }
}

export class UpdateResident {
  constructor(
    private readonly residents: IResidentRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, id: string, input: UpdateResidentDto): Promise<ResidentDto> {
    const resident = await this.residents.findById(actor.tenantId, id);
    if (!resident) throw residentNotFound();

    resident.updateDetails(
      { ...input, residencyType: input.residencyType as ResidencyType | undefined },
      actor.userId,
      this.clock,
    );
    await this.residents.save(resident);
    await this.audit.write({
      userId: actor.userId,
      action: 'RESIDENT_UPDATED',
      ipAddress: actor.ip ?? null,
      metadata: { residentId: resident.id },
    });
    return toResidentDto(resident);
  }
}

export class GetResident {
  constructor(private readonly residents: IResidentRepository) {}

  async execute(actor: TenantActor, id: string): Promise<ResidentDto> {
    const resident = await this.residents.findById(actor.tenantId, id);
    if (!resident) throw residentNotFound();
    return toResidentDto(resident);
  }
}

export class ListResidents {
  constructor(private readonly residents: IResidentRepository) {}

  async execute(actor: TenantActor, query: ResidentListQuery): Promise<CursorResult<ResidentDto>> {
    const result = await this.residents.listCursor(actor.tenantId, query);
    return {
      data: result.data.map(toResidentDto),
      nextCursor: result.nextCursor,
      limit: result.limit,
    };
  }
}
