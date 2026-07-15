import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';
import { Money } from '@domain/common/values/Money';

export interface ServiceProps extends EntityProps {
  buildingId: string | null;
  name: string;
  nameAr: string | null;
  description: string | null;
  monthlyFee: number | null;
  currency: string;
  isActive: boolean;
}

/**
 * Aggregate root: a chargeable building service (cleaning, gym, internet…).
 * Scoped to one building, or offered tenant-wide when buildingId is null.
 */
export class Service extends AggregateRoot {
  readonly buildingId: string | null;
  private _name: string;
  private _nameAr: string | null;
  private _description: string | null;
  private _monthlyFee: Money | null;
  private _isActive: boolean;

  private constructor(props: ServiceProps) {
    super(props);
    this.buildingId = props.buildingId;
    this._name = props.name;
    this._nameAr = props.nameAr;
    this._description = props.description;
    this._monthlyFee = props.monthlyFee == null ? null : Money.of(props.monthlyFee, props.currency);
    this._isActive = props.isActive;
  }

  static create(
    tenantId: string,
    input: {
      buildingId?: string | null;
      name: string;
      nameAr?: string | null;
      description?: string | null;
      monthlyFee?: number | null;
      currency?: string;
    },
    actorId: string | null,
    clock: IClock,
  ): Service {
    invariant(input.name.trim().length >= 2, 'SERVICE_NAME', 'Service name is required');
    invariant(
      input.monthlyFee == null || input.monthlyFee >= 0,
      'SERVICE_FEE',
      'Monthly fee cannot be negative',
    );
    return new Service({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId: input.buildingId ?? null,
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() || null,
      description: input.description?.trim() || null,
      monthlyFee: input.monthlyFee ?? null,
      currency: input.currency ?? 'JOD',
      isActive: true,
    });
  }

  static restore(props: ServiceProps): Service {
    return new Service(props);
  }

  get name(): string {
    return this._name;
  }
  get nameAr(): string | null {
    return this._nameAr;
  }
  get description(): string | null {
    return this._description;
  }
  get monthlyFee(): Money | null {
    return this._monthlyFee;
  }
  get isActive(): boolean {
    return this._isActive;
  }

  setFee(amount: number | null, currency: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(amount == null || amount >= 0, 'SERVICE_FEE', 'Monthly fee cannot be negative');
    this._monthlyFee = amount == null ? null : Money.of(amount, currency);
    this.touch(actorId, clock.now());
  }

  deactivate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._isActive = false;
    this.touch(actorId, clock.now());
  }

  activate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._isActive = true;
    this.touch(actorId, clock.now());
  }

  toProps(): ServiceProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      name: this._name,
      nameAr: this._nameAr,
      description: this._description,
      monthlyFee: this._monthlyFee?.amount ?? null,
      currency: this._monthlyFee?.currency ?? 'JOD',
      isActive: this._isActive,
    };
  }
}
