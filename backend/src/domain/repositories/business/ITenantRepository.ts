import { PageRequest, PageResult } from '@shared/types';

/**
 * Base contract for every tenant-scoped aggregate repository.
 *
 * Tenant isolation is a repository responsibility: EVERY method takes a
 * `tenantId` and implementations MUST filter by it, so a query can never
 * cross tenant boundaries. Soft-deleted rows are excluded unless a method
 * explicitly says otherwise.
 *
 * `save` performs an optimistic-concurrency upsert keyed on the aggregate's
 * RowVersion; a stale write raises a concurrency conflict at the
 * infrastructure layer (implemented in a later sprint).
 */
export interface ITenantRepository<TAggregate> {
  findById(tenantId: string, id: string): Promise<TAggregate | null>;
  findPage(tenantId: string, page: PageRequest): Promise<PageResult<TAggregate>>;
  save(aggregate: TAggregate): Promise<void>;
  /** Soft delete (sets IsDeleted); the aggregate models the state change. */
  remove(aggregate: TAggregate): Promise<void>;
}
