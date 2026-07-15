import { AggregateRoot } from '@domain/common/AggregateRoot';
import { Entity, EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type BuildingStatus = 'Active' | 'UnderConstruction' | 'Inactive';
export type ParkingSpaceType = 'Standard' | 'Covered' | 'Accessible' | 'Visitor';

/* ---------------------------- Floor ---------------------------- */

export interface FloorProps extends EntityProps {
  buildingId: string;
  floorNumber: number;
  name: string | null;
}

/** Child of the Building aggregate — never handled outside its building. */
export class Floor extends Entity {
  readonly buildingId: string;
  readonly floorNumber: number;
  private _name: string | null;

  private constructor(props: FloorProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.floorNumber = props.floorNumber;
    this._name = props.name;
  }

  static create(
    tenantId: string,
    buildingId: string,
    floorNumber: number,
    name: string | null,
    actorId: string | null,
    clock: IClock,
  ): Floor {
    invariant(
      Number.isInteger(floorNumber) && floorNumber >= -5 && floorNumber <= 200,
      'FLOOR_NUMBER',
      'Floor number must be between -5 and 200',
    );
    return new Floor({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId,
      floorNumber,
      name: name?.trim() || null,
    });
  }

  static restore(props: FloorProps): Floor {
    return new Floor(props);
  }

  get name(): string | null {
    return this._name;
  }

  rename(name: string | null, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._name = name?.trim() || null;
    this.touch(actorId, clock.now());
  }

  toProps(): FloorProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      floorNumber: this.floorNumber,
      name: this._name,
    };
  }
}

/* ------------------------- ParkingSpace ------------------------ */

export interface ParkingSpaceProps extends EntityProps {
  buildingId: string;
  spaceNumber: string;
  spaceType: ParkingSpaceType;
  apartmentId: string | null;
  monthlyFee: number | null;
}

/** Child of the Building aggregate. */
export class ParkingSpace extends Entity {
  readonly buildingId: string;
  readonly spaceNumber: string;
  private _spaceType: ParkingSpaceType;
  private _apartmentId: string | null;
  private _monthlyFee: number | null;

  private constructor(props: ParkingSpaceProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.spaceNumber = props.spaceNumber;
    this._spaceType = props.spaceType;
    this._apartmentId = props.apartmentId;
    this._monthlyFee = props.monthlyFee;
  }

  static create(
    tenantId: string,
    buildingId: string,
    input: { spaceNumber: string; spaceType?: ParkingSpaceType; monthlyFee?: number | null },
    actorId: string | null,
    clock: IClock,
  ): ParkingSpace {
    invariant(input.spaceNumber.trim().length > 0, 'SPACE_NUMBER', 'Space number is required');
    invariant(
      input.monthlyFee == null || input.monthlyFee >= 0,
      'SPACE_FEE',
      'Monthly fee cannot be negative',
    );
    return new ParkingSpace({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId,
      spaceNumber: input.spaceNumber.trim(),
      spaceType: input.spaceType ?? 'Standard',
      apartmentId: null,
      monthlyFee: input.monthlyFee ?? null,
    });
  }

  static restore(props: ParkingSpaceProps): ParkingSpace {
    return new ParkingSpace(props);
  }

  get spaceType(): ParkingSpaceType {
    return this._spaceType;
  }
  get apartmentId(): string | null {
    return this._apartmentId;
  }
  get monthlyFee(): number | null {
    return this._monthlyFee;
  }

  assignToApartment(apartmentId: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._spaceType !== 'Visitor', 'SPACE_VISITOR', 'Visitor spaces cannot be assigned');
    invariant(!this._apartmentId, 'SPACE_TAKEN', 'Space is already assigned');
    this._apartmentId = apartmentId;
    this.touch(actorId, clock.now());
  }

  unassign(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._apartmentId, 'SPACE_NOT_ASSIGNED', 'Space is not assigned');
    this._apartmentId = null;
    this.touch(actorId, clock.now());
  }

  toProps(): ParkingSpaceProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      spaceNumber: this.spaceNumber,
      spaceType: this._spaceType,
      apartmentId: this._apartmentId,
      monthlyFee: this._monthlyFee,
    };
  }
}

/* ------------------------- StorageUnit ------------------------- */

export interface StorageUnitProps extends EntityProps {
  buildingId: string;
  unitNumber: string;
  areaSqm: number | null;
  apartmentId: string | null;
  monthlyFee: number | null;
}

/** Child of the Building aggregate. */
export class StorageUnit extends Entity {
  readonly buildingId: string;
  readonly unitNumber: string;
  readonly areaSqm: number | null;
  private _apartmentId: string | null;
  private _monthlyFee: number | null;

  private constructor(props: StorageUnitProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.unitNumber = props.unitNumber;
    this.areaSqm = props.areaSqm;
    this._apartmentId = props.apartmentId;
    this._monthlyFee = props.monthlyFee;
  }

  static create(
    tenantId: string,
    buildingId: string,
    input: { unitNumber: string; areaSqm?: number | null; monthlyFee?: number | null },
    actorId: string | null,
    clock: IClock,
  ): StorageUnit {
    invariant(input.unitNumber.trim().length > 0, 'STORAGE_NUMBER', 'Unit number is required');
    invariant(input.areaSqm == null || input.areaSqm > 0, 'STORAGE_AREA', 'Area must be positive');
    invariant(
      input.monthlyFee == null || input.monthlyFee >= 0,
      'STORAGE_FEE',
      'Monthly fee cannot be negative',
    );
    return new StorageUnit({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId,
      unitNumber: input.unitNumber.trim(),
      areaSqm: input.areaSqm ?? null,
      apartmentId: null,
      monthlyFee: input.monthlyFee ?? null,
    });
  }

  static restore(props: StorageUnitProps): StorageUnit {
    return new StorageUnit(props);
  }

  get apartmentId(): string | null {
    return this._apartmentId;
  }
  get monthlyFee(): number | null {
    return this._monthlyFee;
  }

  assignToApartment(apartmentId: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(!this._apartmentId, 'STORAGE_TAKEN', 'Unit is already assigned');
    this._apartmentId = apartmentId;
    this.touch(actorId, clock.now());
  }

  unassign(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._apartmentId, 'STORAGE_NOT_ASSIGNED', 'Unit is not assigned');
    this._apartmentId = null;
    this.touch(actorId, clock.now());
  }

  toProps(): StorageUnitProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      unitNumber: this.unitNumber,
      areaSqm: this.areaSqm,
      apartmentId: this._apartmentId,
      monthlyFee: this._monthlyFee,
    };
  }
}

/* --------------------------- Building -------------------------- */

export interface BuildingProps extends EntityProps {
  name: string;
  address: string;
  city: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  totalFloors: number;
  yearBuilt: number | null;
  status: BuildingStatus;
  notes: string | null;
}

/**
 * Aggregate root: a physical building. Owns its Floors, ParkingSpaces and
 * StorageUnits (children are only created through the root, which enforces
 * numbering uniqueness). Apartments are a separate aggregate referenced
 * by id — they have their own lifecycle and heavy contention.
 */
export class Building extends AggregateRoot {
  private _name: string;
  private _address: string;
  private _city: string;
  private _district: string | null;
  private _latitude: number | null;
  private _longitude: number | null;
  private _totalFloors: number;
  private _yearBuilt: number | null;
  private _status: BuildingStatus;
  private _notes: string | null;
  private readonly _floors: Floor[];

  private constructor(props: BuildingProps, floors: Floor[]) {
    super(props);
    this._name = props.name;
    this._address = props.address;
    this._city = props.city;
    this._district = props.district;
    this._latitude = props.latitude;
    this._longitude = props.longitude;
    this._totalFloors = props.totalFloors;
    this._yearBuilt = props.yearBuilt;
    this._status = props.status;
    this._notes = props.notes;
    this._floors = floors;
  }

  static create(
    tenantId: string,
    input: {
      name: string;
      address: string;
      city: string;
      district?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      totalFloors: number;
      yearBuilt?: number | null;
      notes?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Building {
    invariant(input.name.trim().length >= 2, 'BUILDING_NAME', 'Name must be at least 2 characters');
    invariant(input.address.trim().length >= 5, 'BUILDING_ADDRESS', 'Address is required');
    invariant(input.city.trim().length >= 2, 'BUILDING_CITY', 'City is required');
    invariant(
      Number.isInteger(input.totalFloors) && input.totalFloors >= 1 && input.totalFloors <= 200,
      'BUILDING_FLOORS',
      'Total floors must be between 1 and 200',
    );
    invariant(
      input.yearBuilt == null || (input.yearBuilt >= 1900 && input.yearBuilt <= 2100),
      'BUILDING_YEAR',
      'Year built must be between 1900 and 2100',
    );
    invariant(
      input.latitude == null || (input.latitude >= -90 && input.latitude <= 90),
      'BUILDING_LAT',
      'Latitude out of range',
    );
    invariant(
      input.longitude == null || (input.longitude >= -180 && input.longitude <= 180),
      'BUILDING_LNG',
      'Longitude out of range',
    );
    return new Building(
      {
        ...newEntityProps(newId(), tenantId, actorId, clock.now()),
        name: input.name.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        district: input.district?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        totalFloors: input.totalFloors,
        yearBuilt: input.yearBuilt ?? null,
        status: 'Active',
        notes: input.notes?.trim() || null,
      },
      [],
    );
  }

  static restore(props: BuildingProps, floors: Floor[] = []): Building {
    return new Building(props, floors);
  }

  get name(): string {
    return this._name;
  }
  get address(): string {
    return this._address;
  }
  get city(): string {
    return this._city;
  }
  get district(): string | null {
    return this._district;
  }
  get latitude(): number | null {
    return this._latitude;
  }
  get longitude(): number | null {
    return this._longitude;
  }
  get totalFloors(): number {
    return this._totalFloors;
  }
  get yearBuilt(): number | null {
    return this._yearBuilt;
  }
  get status(): BuildingStatus {
    return this._status;
  }
  get notes(): string | null {
    return this._notes;
  }
  get floors(): readonly Floor[] {
    return this._floors;
  }

  /** Floors are created only through the aggregate root (unique numbering). */
  addFloor(floorNumber: number, name: string | null, actorId: string | null, clock: IClock): Floor {
    this.assertNotDeleted();
    invariant(
      !this._floors.some((floor) => floor.floorNumber === floorNumber && !floor.isDeleted),
      'FLOOR_DUPLICATE',
      `Floor ${floorNumber} already exists in this building`,
    );
    const floor = Floor.create(this.tenantId, this.id, floorNumber, name, actorId, clock);
    this._floors.push(floor);
    this.touch(actorId, clock.now());
    return floor;
  }

  updateDetails(
    changes: Partial<{
      name: string;
      address: string;
      city: string;
      district: string | null;
      notes: string | null;
    }>,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    if (changes.name !== undefined) {
      invariant(
        changes.name.trim().length >= 2,
        'BUILDING_NAME',
        'Name must be at least 2 characters',
      );
      this._name = changes.name.trim();
    }
    if (changes.address !== undefined) {
      invariant(changes.address.trim().length >= 5, 'BUILDING_ADDRESS', 'Address is required');
      this._address = changes.address.trim();
    }
    if (changes.city !== undefined) {
      invariant(changes.city.trim().length >= 2, 'BUILDING_CITY', 'City is required');
      this._city = changes.city.trim();
    }
    if (changes.district !== undefined) this._district = changes.district?.trim() || null;
    if (changes.notes !== undefined) this._notes = changes.notes?.trim() || null;
    this.touch(actorId, clock.now());
  }

  markUnderConstruction(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._status = 'UnderConstruction';
    this.touch(actorId, clock.now());
  }

  activate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._status = 'Active';
    this.touch(actorId, clock.now());
  }

  deactivate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._status !== 'Inactive', 'BUILDING_INACTIVE', 'Building is already inactive');
    this._status = 'Inactive';
    this.touch(actorId, clock.now());
  }

  toProps(): BuildingProps {
    return {
      ...this.entityProps(),
      name: this._name,
      address: this._address,
      city: this._city,
      district: this._district,
      latitude: this._latitude,
      longitude: this._longitude,
      totalFloors: this._totalFloors,
      yearBuilt: this._yearBuilt,
      status: this._status,
      notes: this._notes,
    };
  }
}
