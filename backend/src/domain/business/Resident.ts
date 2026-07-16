import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type ResidencyType = 'OwnerOccupant' | 'LeaseTenant' | 'FamilyMember';

export interface ResidentProps extends EntityProps {
  /** Currently occupied apartment — null until the resident moves in. */
  apartmentId: string | null;
  userId: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  residencyType: ResidencyType;
  moveInDate: Date | null;
  moveOutDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/**
 * Aggregate root: a person registered with the property manager.
 *
 * Since Sprint 5, registration precedes occupancy: a resident may exist
 * without an apartment (apartmentId/moveInDate null) and is later moved in
 * via the Occupancy workflow (`occupy`). The resident row carries only the
 * CURRENT occupancy; per-stay history lives in the Occupancy aggregate.
 * History is kept by closing residencies (moveOut), never deleting them.
 */
export class Resident extends AggregateRoot {
  private _apartmentId: string | null;
  private _userId: string | null;
  private _fullName: string;
  private _phoneNumber: string;
  private _email: string | null;
  private _residencyType: ResidencyType;
  private _moveInDate: Date | null;
  private _moveOutDate: Date | null;
  private _emergencyContactName: string | null;
  private _emergencyContactPhone: string | null;

  private constructor(props: ResidentProps) {
    super(props);
    this._apartmentId = props.apartmentId;
    this._userId = props.userId;
    this._fullName = props.fullName;
    this._phoneNumber = props.phoneNumber;
    this._email = props.email;
    this._residencyType = props.residencyType;
    this._moveInDate = props.moveInDate;
    this._moveOutDate = props.moveOutDate;
    this._emergencyContactName = props.emergencyContactName;
    this._emergencyContactPhone = props.emergencyContactPhone;
  }

  /** Register a person without an apartment (occupancy comes later). */
  static register(
    tenantId: string,
    input: {
      fullName: string;
      phoneNumber: string;
      email?: string | null;
      residencyType?: ResidencyType;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Resident {
    invariant(input.fullName.trim().length >= 2, 'RESIDENT_NAME', 'Resident name is required');
    invariant(
      /^\+?[0-9]{9,15}$/.test(input.phoneNumber.trim()),
      'RESIDENT_PHONE',
      'Valid phone number is required',
    );
    return new Resident({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      apartmentId: null,
      userId: null,
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      email: input.email?.trim() || null,
      residencyType: input.residencyType ?? 'LeaseTenant',
      moveInDate: null,
      moveOutDate: null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    });
  }

  static restore(props: ResidentProps): Resident {
    return new Resident(props);
  }

  get apartmentId(): string | null {
    return this._apartmentId;
  }
  get userId(): string | null {
    return this._userId;
  }
  get fullName(): string {
    return this._fullName;
  }
  get phoneNumber(): string {
    return this._phoneNumber;
  }
  get email(): string | null {
    return this._email;
  }
  get residencyType(): ResidencyType {
    return this._residencyType;
  }
  get moveInDate(): Date | null {
    return this._moveInDate;
  }
  get moveOutDate(): Date | null {
    return this._moveOutDate;
  }
  get emergencyContactName(): string | null {
    return this._emergencyContactName;
  }
  get emergencyContactPhone(): string | null {
    return this._emergencyContactPhone;
  }
  /** Currently living in an apartment. */
  get isActive(): boolean {
    return this._apartmentId !== null && this._moveOutDate === null && !this.isDeleted;
  }

  /** Stamp the CURRENT occupancy (called by the Move-In workflow). */
  occupy(apartmentId: string, moveInDate: Date, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(!this.isActive, 'RESIDENT_OCCUPIED', 'Resident already occupies an apartment');
    this._apartmentId = apartmentId;
    this._moveInDate = moveInDate;
    this._moveOutDate = null;
    this.touch(actorId, clock.now());
  }

  /** Edit identity/contact details — same invariants as registration. */
  updateDetails(
    changes: Partial<{
      fullName: string;
      phoneNumber: string;
      email: string | null;
      residencyType: ResidencyType;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
    }>,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    if (changes.fullName !== undefined) {
      invariant(changes.fullName.trim().length >= 2, 'RESIDENT_NAME', 'Resident name is required');
      this._fullName = changes.fullName.trim();
    }
    if (changes.phoneNumber !== undefined) {
      invariant(
        /^\+?[0-9]{9,15}$/.test(changes.phoneNumber.trim()),
        'RESIDENT_PHONE',
        'Valid phone number is required',
      );
      this._phoneNumber = changes.phoneNumber.trim();
    }
    if (changes.email !== undefined) this._email = changes.email?.trim() || null;
    if (changes.residencyType !== undefined) this._residencyType = changes.residencyType;
    if (changes.emergencyContactName !== undefined) {
      this._emergencyContactName = changes.emergencyContactName?.trim() || null;
    }
    if (changes.emergencyContactPhone !== undefined) {
      this._emergencyContactPhone = changes.emergencyContactPhone?.trim() || null;
    }
    this.touch(actorId, clock.now());
  }

  /** `date` is the business-effective move-out date (may differ from now). */
  moveOut(date: Date, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(this._apartmentId, 'RESIDENT_NOT_OCCUPIED', 'Resident does not occupy an apartment');
    invariant(!this._moveOutDate, 'RESIDENT_MOVED_OUT', 'Resident has already moved out');
    invariant(
      this._moveInDate !== null && date.getTime() >= this._moveInDate.getTime(),
      'RESIDENT_MOVEOUT_DATE',
      'Move-out date cannot precede move-in date',
    );
    this._moveOutDate = date;
    this.touch(actorId, clock.now());
  }

  /** Link this resident to a registered app account (one-time). */
  linkUser(userId: string, actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(!this._userId, 'RESIDENT_LINKED', 'Resident is already linked to an account');
    this._userId = userId;
    this.touch(actorId, clock.now());
  }

  setEmergencyContact(
    name: string | null,
    phone: string | null,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    this._emergencyContactName = name?.trim() || null;
    this._emergencyContactPhone = phone?.trim() || null;
    this.touch(actorId, clock.now());
  }

  toProps(): ResidentProps {
    return {
      ...this.entityProps(),
      apartmentId: this._apartmentId,
      userId: this._userId,
      fullName: this._fullName,
      phoneNumber: this._phoneNumber,
      email: this._email,
      residencyType: this._residencyType,
      moveInDate: this._moveInDate,
      moveOutDate: this._moveOutDate,
      emergencyContactName: this._emergencyContactName,
      emergencyContactPhone: this._emergencyContactPhone,
    };
  }
}
