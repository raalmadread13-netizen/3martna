import { Entity, EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { DateRange } from '@domain/common/values/DateRange';

export type VisitorAccessStatus =
  'Pending' | 'Approved' | 'Denied' | 'CheckedIn' | 'CheckedOut' | 'Expired' | 'Cancelled';

/* ---------------------------- Visitor --------------------------- */

export interface VisitorProps extends EntityProps {
  apartmentId: string;
  hostUserId: string;
  fullName: string;
  phoneNumber: string | null;
  nationalId: string | null;
  vehiclePlate: string | null;
  purpose: string | null;
}

/**
 * Aggregate root: a person a resident expects. Owns its VisitorAccess
 * passes (the gate-facing lifecycle) — passes are created only through
 * the visitor.
 */
export class Visitor extends Entity {
  readonly apartmentId: string;
  readonly hostUserId: string;
  private _fullName: string;
  private _phoneNumber: string | null;
  private _nationalId: string | null;
  private _vehiclePlate: string | null;
  private _purpose: string | null;

  private constructor(props: VisitorProps) {
    super(props);
    this.apartmentId = props.apartmentId;
    this.hostUserId = props.hostUserId;
    this._fullName = props.fullName;
    this._phoneNumber = props.phoneNumber;
    this._nationalId = props.nationalId;
    this._vehiclePlate = props.vehiclePlate;
    this._purpose = props.purpose;
  }

  static register(
    tenantId: string,
    input: {
      apartmentId: string;
      hostUserId: string;
      fullName: string;
      phoneNumber?: string | null;
      nationalId?: string | null;
      vehiclePlate?: string | null;
      purpose?: string | null;
    },
    actorId: string | null,
  ): Visitor {
    invariant(input.fullName.trim().length >= 2, 'VISITOR_NAME', 'Visitor name is required');
    return new Visitor({
      ...newEntityProps(newId(), tenantId, actorId),
      apartmentId: input.apartmentId,
      hostUserId: input.hostUserId,
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber?.trim() || null,
      nationalId: input.nationalId?.trim() || null,
      vehiclePlate: input.vehiclePlate?.trim() || null,
      purpose: input.purpose?.trim() || null,
    });
  }

  static restore(props: VisitorProps): Visitor {
    return new Visitor(props);
  }

  /** Issue a time-boxed access pass for this visitor. */
  issueAccess(
    window: { validFrom: Date; validUntil: Date },
    preApproved: boolean,
    actorId: string | null,
  ): VisitorAccess {
    this.assertNotDeleted();
    return VisitorAccess.issue(
      this.tenantId,
      {
        visitorId: this.id,
        validFrom: window.validFrom,
        validUntil: window.validUntil,
        preApproved,
      },
      actorId,
    );
  }

  get fullName(): string {
    return this._fullName;
  }
  get phoneNumber(): string | null {
    return this._phoneNumber;
  }
  get nationalId(): string | null {
    return this._nationalId;
  }
  get vehiclePlate(): string | null {
    return this._vehiclePlate;
  }
  get purpose(): string | null {
    return this._purpose;
  }

  toProps(): VisitorProps {
    return {
      ...this.entityProps(),
      apartmentId: this.apartmentId,
      hostUserId: this.hostUserId,
      fullName: this._fullName,
      phoneNumber: this._phoneNumber,
      nationalId: this._nationalId,
      vehiclePlate: this._vehiclePlate,
      purpose: this._purpose,
    };
  }
}

/* ------------------------- VisitorAccess ------------------------ */

export interface VisitorAccessProps extends EntityProps {
  visitorId: string;
  accessCode: string;
  validFrom: Date;
  validUntil: Date;
  status: VisitorAccessStatus;
  approvedByUserId: string | null;
  checkedInAt: Date | null;
  checkedInByUserId: string | null;
  checkedOutAt: Date | null;
  checkedOutByUserId: string | null;
}

/**
 * Aggregate root: a single gate pass carrying a QR access code and a
 * validity window, with a strict check-in/out lifecycle.
 */
export class VisitorAccess extends Entity {
  readonly visitorId: string;
  readonly accessCode: string;
  readonly validFrom: Date;
  readonly validUntil: Date;
  private _status: VisitorAccessStatus;
  private _approvedByUserId: string | null;
  private _checkedInAt: Date | null;
  private _checkedInByUserId: string | null;
  private _checkedOutAt: Date | null;
  private _checkedOutByUserId: string | null;

  private constructor(props: VisitorAccessProps) {
    super(props);
    this.visitorId = props.visitorId;
    this.accessCode = props.accessCode;
    this.validFrom = props.validFrom;
    this.validUntil = props.validUntil;
    this._status = props.status;
    this._approvedByUserId = props.approvedByUserId;
    this._checkedInAt = props.checkedInAt;
    this._checkedInByUserId = props.checkedInByUserId;
    this._checkedOutAt = props.checkedOutAt;
    this._checkedOutByUserId = props.checkedOutByUserId;
  }

  static issue(
    tenantId: string,
    input: { visitorId: string; validFrom: Date; validUntil: Date; preApproved: boolean },
    actorId: string | null,
  ): VisitorAccess {
    DateRange.of(input.validFrom, input.validUntil); // validates window ordering
    return new VisitorAccess({
      ...newEntityProps(newId(), tenantId, actorId),
      visitorId: input.visitorId,
      accessCode: newId(), // GUID QR payload
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      status: input.preApproved ? 'Approved' : 'Pending',
      approvedByUserId: input.preApproved ? actorId : null,
      checkedInAt: null,
      checkedInByUserId: null,
      checkedOutAt: null,
      checkedOutByUserId: null,
    });
  }

  static restore(props: VisitorAccessProps): VisitorAccess {
    return new VisitorAccess(props);
  }

  get status(): VisitorAccessStatus {
    return this._status;
  }
  get window(): DateRange {
    return DateRange.of(this.validFrom, this.validUntil);
  }
  get checkedInAt(): Date | null {
    return this._checkedInAt;
  }
  get checkedOutAt(): Date | null {
    return this._checkedOutAt;
  }
  get approvedByUserId(): string | null {
    return this._approvedByUserId;
  }

  approve(byUserId: string, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Pending',
      'ACCESS_NOT_PENDING',
      'Only pending passes can be approved',
    );
    this._status = 'Approved';
    this._approvedByUserId = byUserId;
    this.touch(actorId);
  }

  deny(byUserId: string, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Pending',
      'ACCESS_NOT_PENDING',
      'Only pending passes can be denied',
    );
    this._status = 'Denied';
    this._approvedByUserId = byUserId;
    this.touch(actorId);
  }

  cancel(actorId: string | null): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Pending' || this._status === 'Approved',
      'ACCESS_NOT_CANCELLABLE',
      'Only pending or approved passes can be cancelled',
    );
    this._status = 'Cancelled';
    this.touch(actorId);
  }

  /** Guard scans the QR at the gate. Validates approval and the time window. */
  checkIn(guardUserId: string, at: Date, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(this._status === 'Approved', 'ACCESS_NOT_APPROVED', 'Pass is not approved');
    invariant(this.window.contains(at), 'ACCESS_OUTSIDE_WINDOW', 'Outside the valid time window');
    this._status = 'CheckedIn';
    this._checkedInAt = at;
    this._checkedInByUserId = guardUserId;
    this.touch(actorId);
  }

  checkOut(guardUserId: string, at: Date, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(this._status === 'CheckedIn', 'ACCESS_NOT_CHECKED_IN', 'Visitor is not checked in');
    this._status = 'CheckedOut';
    this._checkedOutAt = at;
    this._checkedOutByUserId = guardUserId;
    this.touch(actorId);
  }

  /** Approved/Pending pass whose window elapsed → Expired (scheduler). */
  expire(asOf: Date, actorId: string | null): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Pending' || this._status === 'Approved',
      'ACCESS_NOT_EXPIRABLE',
      'Only pending or approved passes can expire',
    );
    invariant(
      this.validUntil.getTime() <= asOf.getTime(),
      'ACCESS_NOT_ELAPSED',
      'Window has not elapsed',
    );
    this._status = 'Expired';
    this.touch(actorId);
  }

  toProps(): VisitorAccessProps {
    return {
      ...this.entityProps(),
      visitorId: this.visitorId,
      accessCode: this.accessCode,
      validFrom: this.validFrom,
      validUntil: this.validUntil,
      status: this._status,
      approvedByUserId: this._approvedByUserId,
      checkedInAt: this._checkedInAt,
      checkedInByUserId: this._checkedInByUserId,
      checkedOutAt: this._checkedOutAt,
      checkedOutByUserId: this._checkedOutByUserId,
    };
  }
}
