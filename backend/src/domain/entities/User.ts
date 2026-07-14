export type UserStatus = 'Active' | 'Suspended';
export type Language = 'ar' | 'en';

export interface User {
  id: number;
  publicId: string;
  /** Multi-tenant readiness — populated when the Tenants feature lands. */
  tenantId: number | null;
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
  createdBy: number | null;
}

/** Shape safe to return to clients — never includes the password hash. */
export interface PublicUser {
  id: number;
  publicId: string;
  tenantId: number | null;
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
  publicId: user.publicId,
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
