export type UserStatus = 'Active' | 'Suspended';
export type Language = 'ar' | 'en';

/** Ids are GUIDs (globally unique — multi-building sync ready, ADR-0003). */
export interface User {
  id: string;
  /** Multi-tenant: null only for platform-level users (e.g. SuperAdmin). */
  tenantId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  passwordHash: string;
  profileImageUrl: string | null;
  preferredLanguage: Language;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

export interface NewUser {
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  passwordHash: string;
  preferredLanguage: Language;
  createdBy: string | null;
}

/** Shape safe to return to clients — never includes the password hash. */
export interface PublicUser {
  id: string;
  tenantId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  profileImageUrl: string | null;
  preferredLanguage: Language;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: Date | null;
  roles: string[];
  permissions: string[];
}

export const toPublicUser = (user: User, roles: string[], permissions: string[]): PublicUser => ({
  id: user.id,
  tenantId: user.tenantId,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  profileImageUrl: user.profileImageUrl,
  preferredLanguage: user.preferredLanguage,
  status: user.status,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  lastLoginAt: user.lastLoginAt,
  roles,
  permissions,
});
