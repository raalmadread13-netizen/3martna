/**
 * Identity of the caller for every tenant-scoped operation. The tenantId
 * always comes from the verified access token (never from client input),
 * which is what makes repository-level tenant isolation trustworthy.
 */
export interface TenantActor {
  tenantId: string;
  userId: string;
  ip?: string | null;
}
