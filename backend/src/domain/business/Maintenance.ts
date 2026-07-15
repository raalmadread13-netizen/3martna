import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Emergency';
export type MaintenanceStatus =
  'Open' | 'Assigned' | 'InProgress' | 'OnHold' | 'Completed' | 'Cancelled' | 'Rejected';

/* ---------------------- MaintenanceCategory --------------------- */

export interface MaintenanceCategoryProps extends EntityProps {
  name: string;
  nameAr: string;
  isActive: boolean;
}

/** Aggregate root: tenant-configurable request category (lookup). */
export class MaintenanceCategory extends AggregateRoot {
  private _name: string;
  private _nameAr: string;
  private _isActive: boolean;

  private constructor(props: MaintenanceCategoryProps) {
    super(props);
    this._name = props.name;
    this._nameAr = props.nameAr;
    this._isActive = props.isActive;
  }

  static create(
    tenantId: string,
    name: string,
    nameAr: string,
    actorId: string | null,
    clock: IClock,
  ): MaintenanceCategory {
    invariant(name.trim().length >= 2, 'CATEGORY_NAME', 'Category name is required');
    invariant(nameAr.trim().length >= 2, 'CATEGORY_NAME_AR', 'Arabic category name is required');
    return new MaintenanceCategory({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      name: name.trim(),
      nameAr: nameAr.trim(),
      isActive: true,
    });
  }

  static restore(props: MaintenanceCategoryProps): MaintenanceCategory {
    return new MaintenanceCategory(props);
  }

  get name(): string {
    return this._name;
  }
  get nameAr(): string {
    return this._nameAr;
  }
  get isActive(): boolean {
    return this._isActive;
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

  toProps(): MaintenanceCategoryProps {
    return {
      ...this.entityProps(),
      name: this._name,
      nameAr: this._nameAr,
      isActive: this._isActive,
    };
  }
}

/* ---------------------- MaintenanceRequest ---------------------- */

export interface MaintenanceRequestProps extends EntityProps {
  buildingId: string;
  apartmentId: string | null;
  categoryId: string;
  requestedByUserId: string;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedToEmployeeId: string | null;
  scheduledFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completionNotes: string | null;
  rating: number | null;
  ratingComment: string | null;
}

const TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  Open: ['Assigned', 'Cancelled', 'Rejected'],
  Assigned: ['InProgress', 'OnHold', 'Cancelled', 'Assigned'],
  InProgress: ['OnHold', 'Completed', 'Cancelled'],
  OnHold: ['Assigned', 'InProgress', 'Cancelled'],
  Completed: [],
  Cancelled: [],
  Rejected: [],
};

/**
 * Aggregate root: a maintenance request with an explicit state machine.
 * Every transition is a named business operation — no free status writes.
 */
export class MaintenanceRequest extends AggregateRoot {
  readonly buildingId: string;
  readonly apartmentId: string | null;
  readonly categoryId: string;
  readonly requestedByUserId: string;
  private _title: string;
  private _description: string | null;
  private _priority: MaintenancePriority;
  private _status: MaintenanceStatus;
  private _assignedToEmployeeId: string | null;
  private _scheduledFor: Date | null;
  private _startedAt: Date | null;
  private _completedAt: Date | null;
  private _completionNotes: string | null;
  private _rating: number | null;
  private _ratingComment: string | null;

  private constructor(props: MaintenanceRequestProps) {
    super(props);
    this.buildingId = props.buildingId;
    this.apartmentId = props.apartmentId;
    this.categoryId = props.categoryId;
    this.requestedByUserId = props.requestedByUserId;
    this._title = props.title;
    this._description = props.description;
    this._priority = props.priority;
    this._status = props.status;
    this._assignedToEmployeeId = props.assignedToEmployeeId;
    this._scheduledFor = props.scheduledFor;
    this._startedAt = props.startedAt;
    this._completedAt = props.completedAt;
    this._completionNotes = props.completionNotes;
    this._rating = props.rating;
    this._ratingComment = props.ratingComment;
  }

  static open(
    tenantId: string,
    input: {
      buildingId: string;
      apartmentId?: string | null;
      categoryId: string;
      requestedByUserId: string;
      title: string;
      description?: string | null;
      priority?: MaintenancePriority;
    },
    actorId: string | null,
    clock: IClock,
  ): MaintenanceRequest {
    invariant(
      input.title.trim().length >= 3,
      'REQUEST_TITLE',
      'Title must be at least 3 characters',
    );
    return new MaintenanceRequest({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      buildingId: input.buildingId,
      apartmentId: input.apartmentId ?? null,
      categoryId: input.categoryId,
      requestedByUserId: input.requestedByUserId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority ?? 'Medium',
      status: 'Open',
      assignedToEmployeeId: null,
      scheduledFor: null,
      startedAt: null,
      completedAt: null,
      completionNotes: null,
      rating: null,
      ratingComment: null,
    });
  }

  static restore(props: MaintenanceRequestProps): MaintenanceRequest {
    return new MaintenanceRequest(props);
  }

  get title(): string {
    return this._title;
  }
  get description(): string | null {
    return this._description;
  }
  get priority(): MaintenancePriority {
    return this._priority;
  }
  get status(): MaintenanceStatus {
    return this._status;
  }
  get assignedToEmployeeId(): string | null {
    return this._assignedToEmployeeId;
  }
  get scheduledFor(): Date | null {
    return this._scheduledFor;
  }
  get startedAt(): Date | null {
    return this._startedAt;
  }
  get completedAt(): Date | null {
    return this._completedAt;
  }
  get completionNotes(): string | null {
    return this._completionNotes;
  }
  get rating(): number | null {
    return this._rating;
  }
  get ratingComment(): string | null {
    return this._ratingComment;
  }
  get isTerminal(): boolean {
    return TRANSITIONS[this._status].length === 0;
  }

  private transitionTo(next: MaintenanceStatus, actorId: string | null, now: Date): void {
    this.assertNotDeleted();
    invariant(
      TRANSITIONS[this._status].includes(next),
      'REQUEST_TRANSITION',
      `Cannot move request from ${this._status} to ${next}`,
    );
    this._status = next;
    this.touch(actorId, now);
  }

  assign(
    employeeId: string,
    scheduledFor: Date | null,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.transitionTo('Assigned', actorId, clock.now());
    this._assignedToEmployeeId = employeeId;
    this._scheduledFor = scheduledFor;
  }

  start(actorId: string | null, clock: IClock): void {
    invariant(this._assignedToEmployeeId, 'REQUEST_UNASSIGNED', 'Request must be assigned first');
    const now = clock.now();
    this.transitionTo('InProgress', actorId, now);
    this._startedAt ??= now;
  }

  hold(actorId: string | null, clock: IClock): void {
    this.transitionTo('OnHold', actorId, clock.now());
  }

  resume(actorId: string | null, clock: IClock): void {
    invariant(this._status === 'OnHold', 'REQUEST_NOT_ON_HOLD', 'Request is not on hold');
    this.transitionTo('InProgress', actorId, clock.now());
  }

  complete(notes: string | null, actorId: string | null, clock: IClock): void {
    const now = clock.now();
    this.transitionTo('Completed', actorId, now);
    this._completedAt = now;
    this._completionNotes = notes?.trim() || null;
  }

  cancel(actorId: string | null, clock: IClock): void {
    this.transitionTo('Cancelled', actorId, clock.now());
  }

  reject(actorId: string | null, clock: IClock): void {
    this.transitionTo('Rejected', actorId, clock.now());
  }

  escalate(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(!this.isTerminal, 'REQUEST_TERMINAL', 'Cannot escalate a closed request');
    const ladder: MaintenancePriority[] = ['Low', 'Medium', 'High', 'Emergency'];
    const index = ladder.indexOf(this._priority);
    invariant(index < ladder.length - 1, 'REQUEST_MAX_PRIORITY', 'Already at maximum priority');
    this._priority = ladder[index + 1];
    this.touch(actorId, clock.now());
  }

  /** Only the requester rates, only once, only after completion. */
  rate(byUserId: string, rating: number, comment: string | null, clock: IClock): void {
    this.assertNotDeleted();
    invariant(
      this._status === 'Completed',
      'REQUEST_NOT_COMPLETED',
      'Only completed requests can be rated',
    );
    invariant(
      byUserId === this.requestedByUserId,
      'REQUEST_NOT_REQUESTER',
      'Only the requester can rate',
    );
    invariant(this._rating === null, 'REQUEST_ALREADY_RATED', 'Request has already been rated');
    invariant(
      Number.isInteger(rating) && rating >= 1 && rating <= 5,
      'REQUEST_RATING',
      'Rating must be 1–5',
    );
    this._rating = rating;
    this._ratingComment = comment?.trim() || null;
    this.touch(byUserId, clock.now());
  }

  toProps(): MaintenanceRequestProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      apartmentId: this.apartmentId,
      categoryId: this.categoryId,
      requestedByUserId: this.requestedByUserId,
      title: this._title,
      description: this._description,
      priority: this._priority,
      status: this._status,
      assignedToEmployeeId: this._assignedToEmployeeId,
      scheduledFor: this._scheduledFor,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      completionNotes: this._completionNotes,
      rating: this._rating,
      ratingComment: this._ratingComment,
    };
  }
}
