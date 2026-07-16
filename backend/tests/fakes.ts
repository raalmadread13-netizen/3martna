import crypto from 'crypto';
import { NewAuditLog } from '@domain/entities/AuditLog';
import { NewRefreshToken, RefreshToken } from '@domain/entities/RefreshToken';
import { Role, UserAuthorization } from '@domain/entities/Role';
import { NewUser, User } from '@domain/entities/User';
import {
  NewVerificationCode,
  VerificationCode,
  VerificationPurpose,
} from '@domain/entities/VerificationCode';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { IEmailSender, ISmsSender } from '@application/interfaces/IMessageSenders';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { AppDependencies } from '@presentation/http/container';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { systemClock } from '@infrastructure/time/SystemClock';
import { InMemoryDashboardRepository } from './fakes.dashboard';
import {
  InMemoryIdempotencyStore,
  InMemoryLeaseContractRepository,
  InMemoryOccupancyRepository,
  InMemoryResidentRepository,
} from './fakes.occupancy';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from './fakes.property';

/* ---------------- users ---------------- */

export class InMemoryUserRepository implements IUserRepository {
  users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id && !user.isDeleted) ?? null;
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    return (
      this.users.find(
        (user) => !user.isDeleted && (user.email === identifier || user.phoneNumber === identifier),
      ) ?? null
    );
  }

  async emailExists(email: string): Promise<boolean> {
    return this.users.some((user) => !user.isDeleted && user.email === email);
  }

  async phoneExists(phoneNumber: string): Promise<boolean> {
    return this.users.some((user) => !user.isDeleted && user.phoneNumber === phoneNumber);
  }

  async create(input: NewUser): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      tenantId: null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      passwordHash: input.passwordHash,
      profileImageUrl: null,
      preferredLanguage: input.preferredLanguage,
      status: 'Active',
      emailVerified: false,
      phoneVerified: false,
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };
    this.users.push(user);
    return user;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.passwordHash = passwordHash;
  }

  async recordLoginSuccess(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) {
      user.lastLoginAt = new Date();
      user.failedLoginCount = 0;
      user.lockedUntil = null;
    }
  }

  async recordLoginFailure(
    userId: string,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    if (user.failedLoginCount + 1 >= maxAttempts) {
      user.lockedUntil = new Date(Date.now() + lockMinutes * 60_000);
      user.failedLoginCount = 0;
    } else {
      user.failedLoginCount += 1;
    }
  }

  async setEmailVerified(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.emailVerified = true;
  }

  async setPhoneVerified(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.phoneVerified = true;
  }
}

/* ---------------- roles ---------------- */

const SEEDED_ROLES = [
  'SuperAdmin',
  'BuildingManager',
  'Resident',
  'MaintenanceEmployee',
  'SecurityGuard',
];

export class InMemoryRoleRepository implements IRoleRepository {
  private readonly roles: Role[] = SEEDED_ROLES.map((name) => ({
    id: crypto.randomUUID(),
    name,
    nameAr: name,
    description: null,
  }));

  /** roleName → permission codes (mirrors seeds 0001 + 0002: SuperAdmin gets all). */
  readonly rolePermissions: Record<string, string[]> = {
    SuperAdmin: [
      'users.read',
      'users.manage',
      'roles.read',
      'roles.manage',
      'audit.read',
      'profile.manage',
      'buildings.read',
      'buildings.manage',
      'apartments.read',
      'apartments.manage',
      'owners.read',
      'owners.manage',
      'residents.read',
      'residents.manage',
      'leases.read',
      'leases.manage',
      'occupancy.read',
      'occupancy.manage',
      'dashboard.read',
    ],
    BuildingManager: [
      'profile.manage',
      'buildings.read',
      'buildings.manage',
      'apartments.read',
      'apartments.manage',
      'owners.read',
      'owners.manage',
      'residents.read',
      'residents.manage',
      'leases.read',
      'leases.manage',
      'occupancy.read',
      'occupancy.manage',
      'dashboard.read',
    ],
    Resident: ['profile.manage', 'buildings.read', 'apartments.read'],
    MaintenanceEmployee: ['profile.manage'],
    SecurityGuard: ['profile.manage'],
  };

  private readonly userRoles = new Map<string, Set<string>>();

  async findByName(name: string): Promise<Role | null> {
    return this.roles.find((role) => role.name === name) ?? null;
  }

  async getUserAuthorization(userId: string): Promise<UserAuthorization> {
    const roleIds = [...(this.userRoles.get(userId) ?? [])];
    const roles = this.roles.filter((role) => roleIds.includes(role.id)).map((role) => role.name);
    const permissions = [...new Set(roles.flatMap((role) => this.rolePermissions[role] ?? []))];
    return { roles, permissions };
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const set = this.userRoles.get(userId) ?? new Set<string>();
    set.add(roleId);
    this.userRoles.set(userId, set);
  }

  async anyUserHasRole(roleName: string): Promise<boolean> {
    const role = await this.findByName(roleName);
    if (!role) return false;
    return [...this.userRoles.values()].some((set) => set.has(role.id));
  }
}

/* ---------------- refresh tokens ---------------- */

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  tokens: RefreshToken[] = [];

  async create(token: NewRefreshToken): Promise<void> {
    this.tokens.push({
      id: crypto.randomUUID(),
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: null,
      replacedByTokenHash: null,
      createdByIp: token.createdByIp,
      createdAt: new Date(),
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async revoke(tokenHash: string, replacedByTokenHash: string | null = null): Promise<void> {
    const token = await this.findByHash(tokenHash);
    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      token.replacedByTokenHash = replacedByTokenHash;
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const token of this.tokens) {
      if (token.userId === userId && !token.revokedAt) token.revokedAt = new Date();
    }
  }

  activeCountFor(userId: string): number {
    return this.tokens.filter((token) => token.userId === userId && !token.revokedAt).length;
  }
}

/* ---------------- verification codes ---------------- */

export class InMemoryVerificationCodeRepository implements IVerificationCodeRepository {
  codes: VerificationCode[] = [];

  async createReplacingActive(code: NewVerificationCode): Promise<void> {
    for (const existing of this.codes) {
      if (
        existing.userId === code.userId &&
        existing.purpose === code.purpose &&
        !existing.consumedAt
      ) {
        existing.consumedAt = new Date();
      }
    }
    this.codes.push({
      id: crypto.randomUUID(),
      userId: code.userId,
      codeHash: code.codeHash,
      purpose: code.purpose,
      expiresAt: code.expiresAt,
      consumedAt: null,
      attemptCount: 0,
      createdAt: new Date(),
    });
  }

  async findActive(userId: string, purpose: VerificationPurpose): Promise<VerificationCode | null> {
    return (
      [...this.codes]
        .reverse()
        .find(
          (code) =>
            code.userId === userId &&
            code.purpose === purpose &&
            !code.consumedAt &&
            code.expiresAt.getTime() > Date.now(),
        ) ?? null
    );
  }

  async incrementAttempts(id: string): Promise<void> {
    const code = this.codes.find((entry) => entry.id === id);
    if (code) code.attemptCount += 1;
  }

  async consume(id: string): Promise<void> {
    const code = this.codes.find((entry) => entry.id === id);
    if (code) code.consumedAt = new Date();
  }
}

/* ---------------- audit / senders / hasher ---------------- */

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  entries: NewAuditLog[] = [];
  async write(entry: NewAuditLog): Promise<void> {
    this.entries.push(entry);
  }
  actions(): string[] {
    return this.entries.map((entry) => entry.action);
  }
}

export class CapturingEmailSender implements IEmailSender {
  sent: Array<{ to: string; subject: string; body: string }> = [];
  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
  }
}

export class CapturingSmsSender implements ISmsSender {
  sent: Array<{ to: string; message: string }> = [];
  async send(to: string, message: string): Promise<void> {
    this.sent.push({ to, message });
  }
}

/** Deterministic, instant hasher — bcrypt itself is covered in security.test.ts. */
export class FakePasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

/* ---------------- bundle ---------------- */

export interface TestWorld {
  deps: AppDependencies;
  users: InMemoryUserRepository;
  roles: InMemoryRoleRepository;
  refreshTokens: InMemoryRefreshTokenRepository;
  verificationCodes: InMemoryVerificationCodeRepository;
  auditLogs: InMemoryAuditLogRepository;
  email: CapturingEmailSender;
  sms: CapturingSmsSender;
  buildings: InMemoryBuildingRepository;
  apartments: InMemoryApartmentRepository;
  owners: InMemoryOwnerRepository;
  residents: InMemoryResidentRepository;
  leases: InMemoryLeaseContractRepository;
  occupancies: InMemoryOccupancyRepository;
  idempotency: InMemoryIdempotencyStore;
  dashboard: InMemoryDashboardRepository;
}

export const buildTestWorld = (): TestWorld => {
  const users = new InMemoryUserRepository();
  const roles = new InMemoryRoleRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const verificationCodes = new InMemoryVerificationCodeRepository();
  const auditLogs = new InMemoryAuditLogRepository();
  const email = new CapturingEmailSender();
  const sms = new CapturingSmsSender();
  const buildings = new InMemoryBuildingRepository();
  const apartments = new InMemoryApartmentRepository();
  const owners = new InMemoryOwnerRepository();
  const residents = new InMemoryResidentRepository();
  const leases = new InMemoryLeaseContractRepository();
  const occupancies = new InMemoryOccupancyRepository();
  const idempotency = new InMemoryIdempotencyStore();
  const dashboard = new InMemoryDashboardRepository(
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
  );
  return {
    users,
    roles,
    refreshTokens,
    verificationCodes,
    auditLogs,
    email,
    sms,
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
    idempotency,
    dashboard,
    deps: {
      users,
      roles,
      refreshTokens,
      verificationCodes,
      auditLogs,
      email,
      sms,
      hasher: new FakePasswordHasher(),
      tokens: tokenService,
      clock: systemClock,
      buildings,
      apartments,
      owners,
      residents,
      leases,
      occupancies,
      idempotency,
      dashboard,
    },
  };
};
