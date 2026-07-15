import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type ComplaintCategory =
  'Noise' | 'Cleanliness' | 'Security' | 'Neighbor' | 'Staff' | 'Facility' | 'Parking' | 'Other';
export type ComplaintStatus = 'Open' | 'InReview' | 'Resolved' | 'Dismissed' | 'Escalated';

export interface ComplaintProps extends EntityProps {
  buildingId: string;
  apartmentId: string | null;
  submittedByUserId: string | null;
  isAnonymous: boolean;
  category: ComplaintCategory;
  subject: string;
  description: string | null;
  status: ComplaintStatus;
  resolution: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
}

const TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  Open: ['InReview', 'Resolved', 'Dismissed', 'Escalated'],
  InReview: ['Resolved', 'Dismissed', 'Escalated'],
  Escalated: ['InReview', 'Resolved', 'Dismissed'],
  Resolved: [],
  Dismissed: [],
};

/**
 * Aggregate root: a resident complaint. Anonymous complaints never carry
 * a submitter id (enforced here and by CK_Complaints_Anonymous).
 */
export class Complaint extends AggregateRoot {
  readonly buildingId: string;
  readonly apartmentId: string | null;
  readonly submittedByUserId: string | null;
  readonly isAnonymous: boolean;
  readonly category: ComplaintCategory;
  private _subject: string;
  private _description: string | null;
  private _status: ComplaintStatus;
  private _resolution: string | null;
  private _resolvedByUserId: string | null;
  private _resolvedAt: Date | null;

  private constructor(props: ComplaintProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.apartmentId = props.apartmentId;
    this.submittedByUserId = props.submittedByUserId;
    this.isAnonymous = props.isAnonymous;
    this.category = props.category;
    this._subject = props.subject;
    this._description = props.description;
    this._status = props.status;
    this._resolution = props.resolution;
    this._resolvedByUserId = props.resolvedByUserId;
    this._resolvedAt = props.resolvedAt;
  }

  static submit(
    tenantId: string,
    input: {
      buildingId: string;
      apartmentId?: string | null;
      submittedByUserId: string | null;
      isAnonymous?: boolean;
      category: ComplaintCategory;
      subject: string;
      description?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Complaint {
    invariant(input.subject.trim().length >= 3, 'COMPLAINT_SUBJECT', 'Subject is required');
    const isAnonymous = input.isAnonymous ?? false;
    return new Complaint({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId: input.buildingId,
      apartmentId: input.apartmentId ?? null,
      // Anonymity is enforced: no submitter id is ever stored
      submittedByUserId: isAnonymous ? null : input.submittedByUserId,
      isAnonymous,
      category: input.category,
      subject: input.subject.trim(),
      description: input.description?.trim() || null,
      status: 'Open',
      resolution: null,
      resolvedByUserId: null,
      resolvedAt: null,
    });
  }

  static restore(props: ComplaintProps): Complaint {
    return new Complaint(props);
  }

  get subject(): string {
    return this._subject;
  }
  get description(): string | null {
    return this._description;
  }
  get status(): ComplaintStatus {
    return this._status;
  }
  get resolution(): string | null {
    return this._resolution;
  }
  get resolvedByUserId(): string | null {
    return this._resolvedByUserId;
  }
  get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  private transitionTo(next: ComplaintStatus, actorId: string | null, now: Date): void {
    this.assertNotDeleted();
    invariant(
      TRANSITIONS[this._status].includes(next),
      'COMPLAINT_TRANSITION',
      `Cannot move complaint from ${this._status} to ${next}`,
    );
    this._status = next;
    this.touch(actorId, now);
  }

  startReview(actorId: string | null, clock: IClock): void {
    this.transitionTo('InReview', actorId, clock.now());
  }

  escalate(actorId: string | null, clock: IClock): void {
    this.transitionTo('Escalated', actorId, clock.now());
  }

  resolve(resolution: string, byUserId: string, actorId: string | null, clock: IClock): void {
    invariant(
      resolution.trim().length >= 3,
      'COMPLAINT_RESOLUTION',
      'A resolution note is required',
    );
    const now = clock.now();
    this.transitionTo('Resolved', actorId, now);
    this._resolution = resolution.trim();
    this._resolvedByUserId = byUserId;
    this._resolvedAt = now;
  }

  dismiss(reason: string, byUserId: string, actorId: string | null, clock: IClock): void {
    invariant(
      reason.trim().length >= 3,
      'COMPLAINT_DISMISS_REASON',
      'A dismissal reason is required',
    );
    const now = clock.now();
    this.transitionTo('Dismissed', actorId, now);
    this._resolution = reason.trim();
    this._resolvedByUserId = byUserId;
    this._resolvedAt = now;
  }

  toProps(): ComplaintProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      apartmentId: this.apartmentId,
      submittedByUserId: this.submittedByUserId,
      isAnonymous: this.isAnonymous,
      category: this.category,
      subject: this._subject,
      description: this._description,
      status: this._status,
      resolution: this._resolution,
      resolvedByUserId: this._resolvedByUserId,
      resolvedAt: this._resolvedAt,
    };
  }
}
