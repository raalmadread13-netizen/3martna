import { Tenant } from '@domain/business/Tenant';
import { PageRequest, PageResult } from '@shared/types';

/**
 * Tenant is the isolation boundary itself, so its repository is
 * platform-scoped (no enclosing tenant) — only SuperAdmins reach it.
 */
export interface ITenantAdminRepository {
  findById(id: string): Promise<Tenant | null>;
  existsByName(name: string): Promise<boolean>;
  save(tenant: Tenant): Promise<void>;
  findPage(page: PageRequest): Promise<PageResult<Tenant>>;
}
