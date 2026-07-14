import { Language, PublicUser, toPublicUser } from '@domain/entities/User';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { TokenIssuer, TokenPair } from '@application/auth/TokenIssuer';
import { checkPasswordPolicy } from '@application/auth/passwordPolicy';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { AppError } from '@shared/errors/AppError';

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  password: string;
  preferredLanguage: Language;
  ip: string | null;
  userAgent: string | null;
}

/** Self-registration role — privileged roles are assigned by admins only. */
const SELF_REGISTRATION_ROLE = 'Resident';

export class RegisterUser {
  constructor(
    private readonly users: IUserRepository,
    private readonly roles: IRoleRepository,
    private readonly hasher: IPasswordHasher,
    private readonly issuer: TokenIssuer,
    private readonly audit: IAuditLogRepository,
  ) {}

  async execute(input: RegisterInput): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const policy = checkPasswordPolicy(input.password);
    if (!policy.valid) {
      throw AppError.badRequest(
        'Password does not meet the policy',
        'WEAK_PASSWORD',
        policy.failures,
      );
    }

    if (await this.users.phoneExists(input.phoneNumber)) {
      throw AppError.conflict('Phone number is already registered', 'PHONE_ALREADY_REGISTERED');
    }
    if (input.email && (await this.users.emailExists(input.email))) {
      throw AppError.conflict('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
    }

    const role = await this.roles.findByName(SELF_REGISTRATION_ROLE);
    if (!role) throw AppError.internal('Default role is not seeded', 'ROLE_NOT_SEEDED');

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      passwordHash,
      preferredLanguage: input.preferredLanguage,
      createdBy: null,
    });
    await this.roles.assignRoleToUser(user.id, role.id, user.id);

    await this.audit.write({
      userId: user.id,
      action: 'REGISTER',
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });

    const { pair, auth } = await this.issuer.issue(user, input.ip);
    return { user: toPublicUser(user, auth.roles, auth.permissions), tokens: pair };
  }
}
