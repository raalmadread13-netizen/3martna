import { Language } from '@domain/entities/User';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { checkPasswordPolicy } from '@application/auth/passwordPolicy';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { AppError } from '@shared/errors/AppError';

export interface BootstrapInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  preferredLanguage?: Language;
}

/**
 * Creates the very first SuperAdmin (ADR-0005: no seeded admin accounts).
 * Refuses to run when any SuperAdmin already exists — this is a one-time
 * bootstrap, not a user-management tool.
 */
export class BootstrapSuperAdmin {
  constructor(
    private readonly users: IUserRepository,
    private readonly roles: IRoleRepository,
    private readonly hasher: IPasswordHasher,
    private readonly audit: IAuditLogRepository,
  ) {}

  async execute(input: BootstrapInput): Promise<{ userId: string; email: string }> {
    if (await this.roles.anyUserHasRole('SuperAdmin')) {
      throw AppError.conflict('A SuperAdmin already exists', 'SUPERADMIN_EXISTS');
    }

    const policy = checkPasswordPolicy(input.password);
    if (!policy.valid) {
      throw AppError.badRequest(
        'Password does not meet the policy',
        'WEAK_PASSWORD',
        policy.failures,
      );
    }
    if (await this.users.emailExists(input.email)) {
      throw AppError.conflict('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
    }
    if (await this.users.phoneExists(input.phoneNumber)) {
      throw AppError.conflict('Phone number is already registered', 'PHONE_ALREADY_REGISTERED');
    }

    const role = await this.roles.findByName('SuperAdmin');
    if (!role) {
      throw AppError.internal(
        'SuperAdmin role is not seeded — run db:seed first',
        'ROLE_NOT_SEEDED',
      );
    }

    const user = await this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      passwordHash: await this.hasher.hash(input.password),
      preferredLanguage: input.preferredLanguage ?? 'ar',
      createdBy: null,
    });
    await this.roles.assignRoleToUser(user.id, role.id, user.id);
    await this.audit.write({ userId: user.id, action: 'SUPERADMIN_BOOTSTRAPPED' });

    return { userId: user.id, email: input.email };
  }
}
