export type AuditAction =
  | 'REGISTER'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'LOGOUT'
  | 'TOKEN_REFRESHED'
  | 'TOKEN_REUSE_DETECTED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFIED'
  | 'PHONE_VERIFIED'
  | 'VERIFICATION_REQUESTED'
  | 'SUPERADMIN_BOOTSTRAPPED'
  // Sprint 4 — Building & Apartment Management
  | 'BUILDING_CREATED'
  | 'BUILDING_UPDATED'
  | 'BUILDING_ARCHIVED'
  | 'FLOOR_ADDED'
  | 'FLOOR_UPDATED'
  | 'APARTMENT_CREATED'
  | 'APARTMENT_UPDATED'
  | 'APARTMENT_ARCHIVED'
  | 'OWNER_CREATED'
  | 'OWNER_UPDATED';

export interface NewAuditLog {
  userId: string | null;
  tenantId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  /** JSON-serializable, must already be redacted (no secrets/passwords). */
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
