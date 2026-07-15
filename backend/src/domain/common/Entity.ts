import { DomainError } from './DomainError';

/**
 * Base of every business entity (Sprint 3 standard columns):
 * GUID id, TenantId, audit stamps, soft delete, optimistic concurrency.
 * Pure TypeScript — no ORM, no framework.
 */
export interface EntityProps {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  isDeleted: boolean;
  /** Opaque RowVersion token from SQL Server (base64). Null before first persist. */
  rowVersion: string | null;
}

export const newEntityProps = (
  id: string,
  tenantId: string,
  createdBy: string | null,
): EntityProps => ({
  id,
  tenantId,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy,
  updatedBy: createdBy,
  isDeleted: false,
  rowVersion: null,
});

export abstract class Entity {
  readonly id: string;
  /** Tenant isolation: every entity belongs to exactly one tenant. */
  readonly tenantId: string;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  private _updatedAt: Date;
  private _updatedBy: string | null;
  private _isDeleted: boolean;
  readonly rowVersion: string | null;

  protected constructor(props: EntityProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
    this.createdBy = props.createdBy;
    this._updatedAt = props.updatedAt;
    this._updatedBy = props.updatedBy;
    this._isDeleted = props.isDeleted;
    this.rowVersion = props.rowVersion;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
  get updatedBy(): string | null {
    return this._updatedBy;
  }
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  /** Stamp modification metadata. Called by every mutating domain method. */
  protected touch(byUserId: string | null): void {
    this._updatedAt = new Date();
    this._updatedBy = byUserId;
  }

  /** Soft delete — rows are never physically removed. */
  softDelete(byUserId: string | null): void {
    if (this._isDeleted) {
      throw new DomainError('ALREADY_DELETED', 'Entity is already deleted');
    }
    this._isDeleted = true;
    this.touch(byUserId);
  }

  protected assertNotDeleted(): void {
    if (this._isDeleted) {
      throw new DomainError('ENTITY_DELETED', 'Cannot modify a deleted entity');
    }
  }

  protected entityProps(): EntityProps {
    return {
      id: this.id,
      tenantId: this.tenantId,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      createdBy: this.createdBy,
      updatedBy: this._updatedBy,
      isDeleted: this._isDeleted,
      rowVersion: this.rowVersion,
    };
  }
}
