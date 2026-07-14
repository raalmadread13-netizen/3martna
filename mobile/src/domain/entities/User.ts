/** Mirrors the backend PublicUser contract (shared/types is canonical). */
export interface User {
  id: number;
  publicId: string;
  tenantId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  profileImageUrl: string | null;
  preferredLanguage: 'ar' | 'en';
  status: 'Active' | 'Suspended';
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
