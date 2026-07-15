import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type TenantStatus = 'Active' | 'Suspended';

export interface TenantProps extends EntityProps {
  name: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: TenantStatus;
}

/**
 * Aggregate root: a paying customer of the platform — a property-management
 * company, an owners' association, or an individual landlord. Every other
 * business entity lives inside exactly one Tenant (isolation boundary).
 *
 * Note: Tenant itself is the boundary, so its `tenantId` equals its own id.
 */
export class Tenant extends AggregateRoot {
  private _name: string;
  private _legalName: string | null;
  private _contactEmail: string | null;
  private _contactPhone: string | null;
  private _status: TenantStatus;

  private constructor(props: TenantProps) {
    super(props);
    this._name = props.name;
    this._legalName = props.legalName;
    this._contactEmail = props.contactEmail;
    this._contactPhone = props.contactPhone;
    this._status = props.status;
  }

  static create(
    input: {
      name: string;
      legalName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Tenant {
    invariant(
      input.name.trim().length >= 2,
      'TENANT_NAME',
      'Tenant name must be at least 2 characters',
    );
    const id = newId();
    return new Tenant({
      ...newEntityProps(id, id, actorId, clock.now()), // a tenant belongs to itself
      name: input.name.trim(),
      legalName: input.legalName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      status: 'Active',
    });
  }

  static restore(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  get name(): string {
    return this._name;
  }
  get legalName(): string | null {
    return this._legalName;
  }
  get contactEmail(): string | null {
    return this._contactEmail;
  }
  get contactPhone(): string | null {
    return this._contactPhone;
  }
  get status(): TenantStatus {
    return this._status;
  }
  get isActive(): boolean {
    return this._status === 'Active' && !this.isDeleted;
  }

  rename(name: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(name.trim().length >= 2, 'TENANT_NAME', 'Tenant name must be at least 2 characters');
    this._name = name.trim();
    this.touch(actorId, clock.now());
  }

  suspend(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Active',
      'TENANT_NOT_ACTIVE',
      'Only active tenants can be suspended',
    );
    this._status = 'Suspended';
    this.touch(actorId, clock.now());
  }

  reactivate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status === 'Suspended', 'TENANT_NOT_SUSPENDED', 'Tenant is not suspended');
    this._status = 'Active';
    this.touch(actorId, clock.now());
  }

  toProps(): TenantProps {
    return {
      ...this.entityProps(),
      name: this._name,
      legalName: this._legalName,
      contactEmail: this._contactEmail,
      contactPhone: this._contactPhone,
      status: this._status,
    };
  }
}
