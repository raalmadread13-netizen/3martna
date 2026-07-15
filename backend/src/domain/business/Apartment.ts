import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type ApartmentStatus =
  'Available' | 'Leased' | 'OwnerOccupied' | 'UnderMaintenance' | 'Reserved';

export interface ApartmentProps extends EntityProps {
  buildingId: string;
  floorId: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number | null;
  baseRentAmount: number | null;
  currency: string;
  status: ApartmentStatus;
  ownerId: string | null;
  description: string | null;
}

/** Statuses an apartment may transition to, from each status. */
const TRANSITIONS: Record<ApartmentStatus, ApartmentStatus[]> = {
  Available: ['Leased', 'OwnerOccupied', 'UnderMaintenance', 'Reserved'],
  Reserved: ['Available', 'Leased', 'OwnerOccupied'],
  Leased: ['Available', 'UnderMaintenance'],
  OwnerOccupied: ['Available', 'UnderMaintenance'],
  UnderMaintenance: ['Available'],
};

/**
 * Aggregate root: a rentable unit. Separate from the Building aggregate
 * because apartments are the contention hot-spot (leases, maintenance,
 * visitors all reference them) — other aggregates hold its id only.
 */
export class Apartment extends AggregateRoot {
  readonly buildingId: string;
  readonly floorId: string;
  readonly unitNumber: string;
  private _bedrooms: number;
  private _bathrooms: number;
  private _areaSqm: number | null;
  private _baseRentAmount: number | null;
  private _currency: string;
  private _status: ApartmentStatus;
  private _ownerId: string | null;
  private _description: string | null;

  private constructor(props: ApartmentProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.floorId = props.floorId;
    this.unitNumber = props.unitNumber;
    this._bedrooms = props.bedrooms;
    this._bathrooms = props.bathrooms;
    this._areaSqm = props.areaSqm;
    this._baseRentAmount = props.baseRentAmount;
    this._currency = props.currency;
    this._status = props.status;
    this._ownerId = props.ownerId;
    this._description = props.description;
  }

  static create(
    tenantId: string,
    input: {
      buildingId: string;
      floorId: string;
      unitNumber: string;
      bedrooms?: number;
      bathrooms?: number;
      areaSqm?: number | null;
      baseRentAmount?: number | null;
      currency?: string;
      description?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Apartment {
    invariant(input.unitNumber.trim().length > 0, 'UNIT_NUMBER', 'Unit number is required');
    const bedrooms = input.bedrooms ?? 1;
    const bathrooms = input.bathrooms ?? 1;
    invariant(
      Number.isInteger(bedrooms) && bedrooms >= 0 && bedrooms <= 20,
      'UNIT_BEDROOMS',
      'Bedrooms must be between 0 and 20',
    );
    invariant(
      Number.isInteger(bathrooms) && bathrooms >= 0 && bathrooms <= 20,
      'UNIT_BATHROOMS',
      'Bathrooms must be between 0 and 20',
    );
    invariant(input.areaSqm == null || input.areaSqm > 0, 'UNIT_AREA', 'Area must be positive');
    invariant(
      input.baseRentAmount == null || input.baseRentAmount >= 0,
      'UNIT_RENT',
      'Base rent cannot be negative',
    );
    return new Apartment({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId: input.buildingId,
      floorId: input.floorId,
      unitNumber: input.unitNumber.trim(),
      bedrooms,
      bathrooms,
      areaSqm: input.areaSqm ?? null,
      baseRentAmount: input.baseRentAmount ?? null,
      currency: input.currency ?? 'JOD',
      status: 'Available',
      ownerId: null,
      description: input.description?.trim() || null,
    });
  }

  static restore(props: ApartmentProps): Apartment {
    return new Apartment(props);
  }

  get bedrooms(): number {
    return this._bedrooms;
  }
  get bathrooms(): number {
    return this._bathrooms;
  }
  get areaSqm(): number | null {
    return this._areaSqm;
  }
  get baseRentAmount(): number | null {
    return this._baseRentAmount;
  }
  get currency(): string {
    return this._currency;
  }
  get status(): ApartmentStatus {
    return this._status;
  }
  get ownerId(): string | null {
    return this._ownerId;
  }
  get description(): string | null {
    return this._description;
  }
  get isOccupied(): boolean {
    return this._status === 'Leased' || this._status === 'OwnerOccupied';
  }

  private transitionTo(next: ApartmentStatus, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      TRANSITIONS[this._status].includes(next),
      'UNIT_TRANSITION',
      `Cannot move apartment from ${this._status} to ${next}`,
    );
    this._status = next;
    this.touch(actorId, clock.now());
  }

  markLeased(actorId: string | null, clock: IClock): void {
    this.transitionTo('Leased', actorId, clock);
  }
  markOwnerOccupied(actorId: string | null, clock: IClock): void {
    invariant(this._ownerId, 'UNIT_NO_OWNER', 'Assign an owner before marking owner-occupied');
    this.transitionTo('OwnerOccupied', actorId, clock);
  }
  markAvailable(actorId: string | null, clock: IClock): void {
    this.transitionTo('Available', actorId, clock);
  }
  markUnderMaintenance(actorId: string | null, clock: IClock): void {
    this.transitionTo('UnderMaintenance', actorId, clock);
  }
  reserve(actorId: string | null, clock: IClock): void {
    this.transitionTo('Reserved', actorId, clock);
  }

  assignOwner(ownerId: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._ownerId = ownerId;
    this.touch(actorId, clock.now());
  }

  /** Edit descriptive attributes — same invariants as `create`. */
  updateDetails(
    changes: Partial<{
      bedrooms: number;
      bathrooms: number;
      areaSqm: number | null;
      baseRentAmount: number | null;
      description: string | null;
    }>,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    if (changes.bedrooms !== undefined) {
      invariant(
        Number.isInteger(changes.bedrooms) && changes.bedrooms >= 0 && changes.bedrooms <= 20,
        'UNIT_BEDROOMS',
        'Bedrooms must be between 0 and 20',
      );
      this._bedrooms = changes.bedrooms;
    }
    if (changes.bathrooms !== undefined) {
      invariant(
        Number.isInteger(changes.bathrooms) && changes.bathrooms >= 0 && changes.bathrooms <= 20,
        'UNIT_BATHROOMS',
        'Bathrooms must be between 0 and 20',
      );
      this._bathrooms = changes.bathrooms;
    }
    if (changes.areaSqm !== undefined) {
      invariant(
        changes.areaSqm == null || changes.areaSqm > 0,
        'UNIT_AREA',
        'Area must be positive',
      );
      this._areaSqm = changes.areaSqm;
    }
    if (changes.baseRentAmount !== undefined) {
      invariant(
        changes.baseRentAmount == null || changes.baseRentAmount >= 0,
        'UNIT_RENT',
        'Base rent cannot be negative',
      );
      this._baseRentAmount = changes.baseRentAmount;
    }
    if (changes.description !== undefined) this._description = changes.description?.trim() || null;
    this.touch(actorId, clock.now());
  }

  setBaseRent(amount: number | null, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(amount == null || amount >= 0, 'UNIT_RENT', 'Base rent cannot be negative');
    this._baseRentAmount = amount;
    this.touch(actorId, clock.now());
  }

  toProps(): ApartmentProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      floorId: this.floorId,
      unitNumber: this.unitNumber,
      bedrooms: this._bedrooms,
      bathrooms: this._bathrooms,
      areaSqm: this._areaSqm,
      baseRentAmount: this._baseRentAmount,
      currency: this._currency,
      status: this._status,
      ownerId: this._ownerId,
      description: this._description,
    };
  }
}
