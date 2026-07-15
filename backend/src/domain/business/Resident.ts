import { Entity, EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';

export type ResidencyType = 'OwnerOccupant' | 'LeaseTenant' | 'FamilyMember';

export interface ResidentProps extends EntityProps {
  apartmentId: string;
  userId: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  residencyType: ResidencyType;
  moveInDate: Date;
  moveOutDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/**
 * Aggregate root: a person living in an apartment. History is kept by
 * closing residencies (moveOut) rather than deleting them.
 */
export class Resident extends Entity {
  readonly apartmentId: string;
  private _userId: string | null;
  private _fullName: string;
  private _phoneNumber: string;
  private _email: string | null;
  readonly residencyType: ResidencyType;
  readonly moveInDate: Date;
  private _moveOutDate: Date | null;
  private _emergencyContactName: string | null;
  private _emergencyContactPhone: string | null;

  private constructor(props: ResidentProps) {
    super(props);
    this.apartmentId = props.apartmentId;
    this._userId = props.userId;
    this._fullName = props.fullName;
    this._phoneNumber = props.phoneNumber;
    this._email = props.email;
    this.residencyType = props.residencyType;
    this.moveInDate = props.moveInDate;
    this._moveOutDate = props.moveOutDate;
    this._emergencyContactName = props.emergencyContactName;
    this._emergencyContactPhone = props.emergencyContactPhone;
  }

  static moveIn(
    tenantId: string,
    input: {
      apartmentId: string;
      fullName: string;
      phoneNumber: string;
      email?: string | null;
      residencyType: ResidencyType;
      moveInDate: Date;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
    },
    actorId: string | null,
  ): Resident {
    invariant(input.fullName.trim().length >= 2, 'RESIDENT_NAME', 'Resident name is required');
    invariant(
      /^\+?[0-9]{9,15}$/.test(input.phoneNumber.trim()),
      'RESIDENT_PHONE',
      'Valid phone number is required',
    );
    return new Resident({
      ...newEntityProps(newId(), tenantId, actorId),
      apartmentId: input.apartmentId,
      userId: null,
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      email: input.email?.trim() || null,
      residencyType: input.residencyType,
      moveInDate: input.moveInDate,
      moveOutDate: null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    });
  }

  static restore(props: ResidentProps): Resident {
    return new Resident(props);
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
  get moveOutDate(): Date | null {
    return this._moveOutDate;
  }
  get isActive(): boolean {
    return this._moveOutDate === null && !this.isDeleted;
  }

  moveOut(date: Date, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(!this._moveOutDate, 'RESIDENT_MOVED_OUT', 'Resident has already moved out');
    invariant(
      date.getTime() >= this.moveInDate.getTime(),
      'RESIDENT_MOVEOUT_DATE',
      'Move-out date cannot precede move-in date',
    );
    this._moveOutDate = date;
    this.touch(actorId);
  }

  /** Link this resident to a registered app account (one-time). */
  linkUser(userId: string, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(!this._userId, 'RESIDENT_LINKED', 'Resident is already linked to an account');
    this._userId = userId;
    this.touch(actorId);
  }

  setEmergencyContact(name: string | null, phone: string | null, actorId: string | null): void {
    this.assertNotDeleted();
    this._emergencyContactName = name?.trim() || null;
    this._emergencyContactPhone = phone?.trim() || null;
    this.touch(actorId);
  }

  toProps(): ResidentProps {
    return {
      ...this.entityProps(),
      apartmentId: this.apartmentId,
      userId: this._userId,
      fullName: this._fullName,
      phoneNumber: this._phoneNumber,
      email: this._email,
      residencyType: this.residencyType,
      moveInDate: this.moveInDate,
      moveOutDate: this._moveOutDate,
      emergencyContactName: this._emergencyContactName,
      emergencyContactPhone: this._emergencyContactPhone,
    };
  }
}
