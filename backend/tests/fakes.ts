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

/* ---------------- users ---------------- */

export class InMemoryUserRepository implements IUserRepository {
  users: User[] = [];
  private nextId = 1;

  async findById(id: number): Promise<User | null> {
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
      id: this.nextId++,
      publicId: `pub-${this.nextId}`,
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

  async setPasswordHash(userId: number, passwordHash: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.passwordHash = passwordHash;
  }

  async recordLoginSuccess(userId: number): Promise<void> {
    const user = await this.findById(userId);
    if (user) {
      user.lastLoginAt = new Date();
      user.failedLoginCount = 0;
      user.lockedUntil = null;
    }
  }

  async recordLoginFailure(
    userId: number,
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

  async setEmailVerified(userId: number): Promise<void> {
    const user = await this.findById(userId);
    if (user) user.emailVerified = true;
  }

  async setPhoneVerified(userId: number): Promise<void> {
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
  private readonly roles: Role[] = SEEDED_ROLES.map((name, index) => ({
    id: index + 1,
    name,
    nameAr: name,
    description: null,
  }));

  /** roleName → permission codes (mirrors the seed: SuperAdmin gets all). */
  readonly rolePermissions: Record<string, string[]> = {
    SuperAdmin: [
      'users.read',
      'users.manage',
      'roles.read',
      'roles.manage',
      'audit.read',
      'profile.manage',
    ],
    BuildingManager: ['profile.manage'],
    Resident: ['profile.manage'],
    MaintenanceEmployee: ['profile.manage'],
    SecurityGuard: ['profile.manage'],
  };

  private readonly userRoles = new Map<number, Set<number>>();

  async findByName(name: string): Promise<Role | null> {
    return this.roles.find((role) => role.name === name) ?? null;
  }

  async getUserAuthorization(userId: number): Promise<UserAuthorization> {
    const roleIds = [...(this.userRoles.get(userId) ?? [])];
    const roles = this.roles.filter((role) => roleIds.includes(role.id)).map((role) => role.name);
    const permissions = [...new Set(roles.flatMap((role) => this.rolePermissions[role] ?? []))];
    return { roles, permissions };
  }

  async assignRoleToUser(userId: number, roleId: number): Promise<void> {
    const set = this.userRoles.get(userId) ?? new Set<number>();
    set.add(roleId);
    this.userRoles.set(userId, set);
  }
}

/* ---------------- refresh tokens ---------------- */

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  tokens: RefreshToken[] = [];
  private nextId = 1;

  async create(token: NewRefreshToken): Promise<void> {
    this.tokens.push({
      id: this.nextId++,
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

  async revokeAllForUser(userId: number): Promise<void> {
    for (const token of this.tokens) {
      if (token.userId === userId && !token.revokedAt) token.revokedAt = new Date();
    }
  }

  activeCountFor(userId: number): number {
    return this.tokens.filter((token) => token.userId === userId && !token.revokedAt).length;
  }
}

/* ---------------- verification codes ---------------- */

export class InMemoryVerificationCodeRepository implements IVerificationCodeRepository {
  codes: VerificationCode[] = [];
  private nextId = 1;

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
      id: this.nextId++,
      userId: code.userId,
      codeHash: code.codeHash,
      purpose: code.purpose,
      expiresAt: code.expiresAt,
      consumedAt: null,
      attemptCount: 0,
      createdAt: new Date(),
    });
  }

  async findActive(userId: number, purpose: VerificationPurpose): Promise<VerificationCode | null> {
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

  async incrementAttempts(id: number): Promise<void> {
    const code = this.codes.find((entry) => entry.id === id);
    if (code) code.attemptCount += 1;
  }

  async consume(id: number): Promise<void> {
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
}

export const buildTestWorld = (): TestWorld => {
  const users = new InMemoryUserRepository();
  const roles = new InMemoryRoleRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const verificationCodes = new InMemoryVerificationCodeRepository();
  const auditLogs = new InMemoryAuditLogRepository();
  const email = new CapturingEmailSender();
  const sms = new CapturingSmsSender();
  return {
    users,
    roles,
    refreshTokens,
    verificationCodes,
    auditLogs,
    email,
    sms,
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
    },
  };
};
