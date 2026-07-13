import bcrypt from 'bcryptjs';
import { execProc, execProcOne } from '../../config/db';
import { verifyFirebaseIdToken } from '../../config/firebase';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import {
  generateRefreshToken,
  generateResetToken,
  hashToken,
  signAccessToken,
} from '../../utils/tokens';
import { RoleName } from '../../types';

const BCRYPT_ROUNDS = 12;

export interface UserRecord {
  UserId: number;
  PublicId: string;
  FullName: string;
  Email: string | null;
  Phone: string;
  PasswordHash?: string;
  PreferredLanguage: string;
  IsActive: boolean;
  IsPhoneVerified: boolean;
  ProfileImageUrl: string | null;
  Roles: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const parseRoles = (roles: string | null): RoleName[] =>
  (roles ?? '').split(',').filter(Boolean) as RoleName[];

const issueTokens = async (user: UserRecord, ip?: string): Promise<AuthTokens> => {
  const roles = parseRoles(user.Roles);
  const accessToken = signAccessToken(user.UserId, user.FullName, roles);
  const refresh = generateRefreshToken();
  await execProc('sp_RefreshToken_Create', {
    UserId: user.UserId,
    TokenHash: refresh.hash,
    ExpiresAt: refresh.expiresAt,
    CreatedByIp: ip ?? null,
  });
  return { accessToken, refreshToken: refresh.token };
};

const registerDevice = async (
  userId: number,
  deviceKey?: string | null,
  fcmToken?: string | null,
  platform = 'android',
): Promise<void> => {
  if (!deviceKey) return;
  await execProc('sp_UserDevice_Register', {
    UserId: userId,
    DeviceKey: deviceKey,
    FcmToken: fcmToken ?? null,
    Platform: platform,
  });
};

export const toPublicUser = (
  user: UserRecord,
): Omit<UserRecord, 'PasswordHash' | 'Roles'> & { Roles: RoleName[] } => {
  const { PasswordHash: _hash, ...rest } = user;
  return { ...rest, Roles: parseRoles(user.Roles) };
};

export const authService = {
  async register(input: {
    fullName: string;
    email?: string | null;
    phone: string;
    password: string;
    nationalId?: string | null;
    preferredLanguage: string;
    role: string;
    firebaseIdToken?: string | null;
  }): Promise<{ user: ReturnType<typeof toPublicUser>; tokens: AuthTokens }> {
    // Self-registration is limited to non-privileged roles.
    if (!['Tenant', 'ApartmentOwner', 'BuildingOwner'].includes(input.role)) {
      throw ApiError.forbidden('Role cannot be self-assigned', 'ROLE_NOT_ALLOWED');
    }

    let firebaseUid: string | null = null;
    let phoneVerified = false;
    if (input.firebaseIdToken) {
      const decoded = await verifyFirebaseIdToken(input.firebaseIdToken).catch(() => null);
      if (decoded?.phone_number && decoded.phone_number === input.phone) {
        firebaseUid = decoded.uid;
        phoneVerified = true;
      }
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await execProcOne<UserRecord>('sp_User_Create', {
      FullName: input.fullName,
      Email: input.email || null,
      Phone: input.phone,
      PasswordHash: passwordHash,
      NationalId: input.nationalId || null,
      PreferredLanguage: input.preferredLanguage,
      FirebaseUid: firebaseUid,
      RoleName: input.role,
    });
    if (!user) throw ApiError.internal('User creation failed');

    if (phoneVerified) {
      await execProc('sp_User_MarkPhoneVerified', { UserId: user.UserId, FirebaseUid: firebaseUid });
      user.IsPhoneVerified = true;
    }

    const tokens = await issueTokens(user);
    logger.info('User registered', { userId: user.UserId, role: input.role });
    return { user: toPublicUser(user), tokens };
  },

  async login(input: {
    identifier: string;
    password: string;
    ip?: string;
    deviceKey?: string | null;
    fcmToken?: string | null;
    platform?: string;
  }): Promise<{ user: ReturnType<typeof toPublicUser>; tokens: AuthTokens }> {
    const user = await execProcOne<UserRecord>('sp_User_GetForLogin', {
      Identifier: input.identifier,
    });
    // Constant-shape failure: same error for unknown user & wrong password.
    const invalid = ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
    if (!user?.PasswordHash) throw invalid;
    const matches = await bcrypt.compare(input.password, user.PasswordHash);
    if (!matches) throw invalid;
    if (!user.IsActive) throw ApiError.forbidden('Account is disabled', 'ACCOUNT_DISABLED');

    const tokens = await issueTokens(user, input.ip);
    await execProc('sp_User_UpdateLastLogin', { UserId: user.UserId });
    await registerDevice(user.UserId, input.deviceKey, input.fcmToken, input.platform);
    return { user: toPublicUser(user), tokens };
  },

  /** Login (or auto-register) using a Firebase phone-OTP ID token. */
  async otpLogin(input: {
    firebaseIdToken: string;
    ip?: string;
    deviceKey?: string | null;
    fcmToken?: string | null;
    platform?: string;
  }): Promise<{ user: ReturnType<typeof toPublicUser>; tokens: AuthTokens }> {
    const decoded = await verifyFirebaseIdToken(input.firebaseIdToken).catch(() => null);
    if (!decoded?.phone_number) {
      throw ApiError.unauthorized('OTP verification failed', 'OTP_INVALID');
    }

    const user = await execProcOne<UserRecord>('sp_User_GetForLogin', {
      Identifier: decoded.phone_number,
    });
    if (!user) {
      throw ApiError.notFound('No account found for this phone number', 'ACCOUNT_NOT_FOUND');
    }
    if (!user.IsActive) throw ApiError.forbidden('Account is disabled', 'ACCOUNT_DISABLED');

    if (!user.IsPhoneVerified) {
      await execProc('sp_User_MarkPhoneVerified', { UserId: user.UserId, FirebaseUid: decoded.uid });
    }
    const tokens = await issueTokens(user, input.ip);
    await execProc('sp_User_UpdateLastLogin', { UserId: user.UserId });
    await registerDevice(user.UserId, input.deviceKey, input.fcmToken, input.platform);
    return { user: toPublicUser(user), tokens };
  },

  /** Rotate a refresh token: revoke the old one, issue a new pair. */
  async refresh(refreshToken: string, ip?: string): Promise<AuthTokens> {
    const oldHash = hashToken(refreshToken);
    const next = generateRefreshToken();
    const rotated = await execProcOne<{ UserId: number }>('sp_RefreshToken_Rotate', {
      OldTokenHash: oldHash,
      NewTokenHash: next.hash,
      ExpiresAt: next.expiresAt,
      CreatedByIp: ip ?? null,
    });
    if (!rotated) throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

    const user = await execProcOne<UserRecord>('sp_User_GetById', { UserId: rotated.UserId });
    if (!user || !user.IsActive) {
      throw ApiError.unauthorized('Account unavailable', 'ACCOUNT_DISABLED');
    }
    return {
      accessToken: signAccessToken(user.UserId, user.FullName, parseRoles(user.Roles)),
      refreshToken: next.token,
    };
  },

  async logout(userId: number, refreshToken: string, deviceKey?: string | null): Promise<void> {
    await execProc('sp_RefreshToken_Revoke', { TokenHash: hashToken(refreshToken) });
    if (deviceKey) {
      await execProc('sp_UserDevice_Remove', { UserId: userId, DeviceKey: deviceKey });
    }
  },

  /**
   * Create a password-reset token. Always resolves success to the caller
   * (no account enumeration); the token would be delivered by SMS/email.
   * In non-production the token is returned for testing.
   */
  async forgotPassword(identifier: string): Promise<{ resetToken?: string }> {
    const user = await execProcOne<UserRecord>('sp_User_GetForLogin', { Identifier: identifier });
    if (!user) return {};
    const reset = generateResetToken();
    await execProc('sp_PasswordReset_Create', {
      UserId: user.UserId,
      TokenHash: reset.hash,
      ExpiresAt: reset.expiresAt,
    });
    logger.info('Password reset requested', { userId: user.UserId });
    return process.env.NODE_ENV === 'production' ? {} : { resetToken: reset.token };
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await execProcOne<{ Id: number; UserId: number }>('sp_PasswordReset_GetValid', {
      TokenHash: hashToken(token),
    });
    if (!record) throw ApiError.badRequest('Invalid or expired reset token', 'RESET_TOKEN_INVALID');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await execProc('sp_User_UpdatePassword', { UserId: record.UserId, PasswordHash: passwordHash });
    await execProc('sp_PasswordReset_MarkUsed', { Id: record.Id });
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await execProcOne<UserRecord>('sp_User_GetById', { UserId: userId });
    if (!user) throw ApiError.notFound('User not found');
    const login = await execProcOne<UserRecord>('sp_User_GetForLogin', { Identifier: user.Phone });
    if (!login?.PasswordHash || !(await bcrypt.compare(currentPassword, login.PasswordHash))) {
      throw ApiError.unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await execProc('sp_User_UpdatePassword', { UserId: userId, PasswordHash: passwordHash });
  },
};
