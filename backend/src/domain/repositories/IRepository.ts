import { BaseEntity } from '@domain/entities/BaseEntity';
import { PageRequest, PageResult } from '@shared/types';

/**
 * Generic repository contract for identity records.
 * Business aggregates define their own purpose-built interfaces in
 * `domain/repositories/business/` — prefer those over this generic shape.
 */
export interface IRepository<T extends BaseEntity> {
  findById(id: string): Promise<T | null>;
  findPage(request: PageRequest): Promise<PageResult<T>>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, changes: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}
