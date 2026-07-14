import { PublicUser, toPublicUser } from '@domain/entities/User';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { TokenIssuer, TokenPair } from '@application/auth/TokenIssuer';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { AppError } from '@shared/errors/AppError';

export interface LoginInput {
  identifier: string; // email or phone
  password: string;
  ip: string | null;
  userAgent: string | null;
}

export interface LockoutConfig {
  maxFailedLogins: number;
  lockoutMinutes: number;
}

/** One generic error for every credential failure — no user enumeration. */
const invalidCredentials = (): AppError =>
  AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');

export class LoginUser {
  /** Compared against when the user doesn't exist, to equalize timing. */
  private dummyHash: string | null = null;

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly issuer: TokenIssuer,
    private readonly audit: IAuditLogRepository,
    private readonly lockout: LockoutConfig,
  ) {}

  async execute(input: LoginInput): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.users.findByEmailOrPhone(input.identifier);

    if (!user) {
      // Burn comparable CPU time so response timing doesn't reveal existence
      this.dummyHash ??= await this.hasher.hash('anti-enumeration-dummy-password');
      await this.hasher.compare(input.password, this.dummyHash);
      throw invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppError(429, 'Too many attempts — try again later', 'ACCOUNT_LOCKED');
    }

    const matches = await this.hasher.compare(input.password, user.passwordHash);
    if (!matches) {
      await this.users.recordLoginFailure(
        user.id,
        this.lockout.maxFailedLogins,
        this.lockout.lockoutMinutes,
      );
      await this.audit.write({
        userId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress: input.ip,
        userAgent: input.userAgent,
      });
      throw invalidCredentials();
    }

    if (user.status !== 'Active') {
      throw AppError.forbidden('Account is disabled', 'ACCOUNT_DISABLED');
    }

    await this.users.recordLoginSuccess(user.id);
    await this.audit.write({
      userId: user.id,
      action: 'LOGIN',
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });

    const { pair, auth } = await this.issuer.issue(user, input.ip);
    return { user: toPublicUser(user, auth.roles, auth.permissions), tokens: pair };
  }
}
