import { BaseEntity } from '@domain/entities/BaseEntity';
import { PageRequest, PageResult } from '@shared/types';

/**
 * Repository contract the domain layer depends on.
 * Concrete SQL Server implementations live in
 * `infrastructure/database/repositories` and are bound in later sprints.
 */
export interface IRepository<T extends BaseEntity> {
  findById(id: number): Promise<T | null>;
  findPage(request: PageRequest): Promise<PageResult<T>>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: number, changes: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;
}
