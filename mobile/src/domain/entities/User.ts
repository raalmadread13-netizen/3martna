/** Mirrors the backend PublicUser contract (ids are GUIDs, ADR-0003). */
export interface User {
  id: string;
  tenantId: string | null;
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
