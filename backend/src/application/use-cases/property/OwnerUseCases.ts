import { Owner, OwnerType } from '@domain/business/Owner';
import { IClock } from '@domain/common/time/IClock';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IOwnerRepository } from '@domain/repositories/business/property.repositories';
import { CreateOwnerDto, OwnerDto, UpdateOwnerDto } from '@application/dtos/property.dto';
import { toOwnerDto } from '@application/mappers/property.mapper';
import { AppError } from '@shared/errors/AppError';
import { PageRequest, PageResult } from '@shared/types';
import { TenantActor } from './context';

const ownerNotFound = (): AppError => AppError.notFound('Owner not found', 'OWNER_NOT_FOUND');

export class CreateOwner {
  constructor(
    private readonly owners: IOwnerRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, input: CreateOwnerDto): Promise<OwnerDto> {
    const owner = Owner.create(
      actor.tenantId,
      { ...input, ownerType: input.ownerType as OwnerType | undefined },
      actor.userId,
      this.clock,
    );
    await this.owners.save(owner);
    await this.audit.write({
      userId: actor.userId,
      action: 'OWNER_CREATED',
      ipAddress: actor.ip ?? null,
      metadata: { ownerId: owner.id, fullName: owner.fullName },
    });
    return toOwnerDto(owner);
  }
}

export class UpdateOwner {
  constructor(
    private readonly owners: IOwnerRepository,
    private readonly audit: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(actor: TenantActor, id: string, input: UpdateOwnerDto): Promise<OwnerDto> {
    const owner = await this.owners.findById(actor.tenantId, id);
    if (!owner) throw ownerNotFound();

    if (
      input.fullName !== undefined ||
      input.companyName !== undefined ||
      input.nationalIdOrRegistration !== undefined
    ) {
      owner.updateDetails(
        {
          fullName: input.fullName,
          companyName: input.companyName,
          nationalIdOrRegistration: input.nationalIdOrRegistration,
        },
        actor.userId,
        this.clock,
      );
    }
    if (
      input.email !== undefined ||
      input.phoneNumber !== undefined ||
      input.address !== undefined
    ) {
      owner.updateContact(
        { email: input.email, phoneNumber: input.phoneNumber, address: input.address },
        actor.userId,
        this.clock,
      );
    }

    await this.owners.save(owner);
    await this.audit.write({
      userId: actor.userId,
      action: 'OWNER_UPDATED',
      ipAddress: actor.ip ?? null,
      metadata: { ownerId: owner.id },
    });
    return toOwnerDto(owner);
  }
}

export class GetOwner {
  constructor(private readonly owners: IOwnerRepository) {}

  async execute(actor: TenantActor, id: string): Promise<OwnerDto> {
    const owner = await this.owners.findById(actor.tenantId, id);
    if (!owner) throw ownerNotFound();
    return toOwnerDto(owner);
  }
}

export class ListOwners {
  constructor(private readonly owners: IOwnerRepository) {}

  async execute(actor: TenantActor, page: PageRequest): Promise<PageResult<OwnerDto>> {
    const result = await this.owners.listByTenant(actor.tenantId, page);
    return { data: result.data.map(toOwnerDto), pagination: result.pagination };
  }
}
