import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export type AnnouncementAudience = 'All' | 'Residents' | 'Owners' | 'Staff';
export type NotificationCategory =
  'Payment' | 'Maintenance' | 'Complaint' | 'Visitor' | 'Announcement' | 'Security' | 'System';

/* -------------------------- Announcement ------------------------ */

export interface AnnouncementProps extends EntityProps {
  buildingId: string | null;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  isPinned: boolean;
  publishedAt: Date;
  expiresAt: Date | null;
}

/**
 * Aggregate root: a broadcast message. Scope is a single building, or the
 * whole tenant when buildingId is null.
 */
export class Announcement extends AggregateRoot {
  readonly buildingId: string | null;
  private _title: string;
  private _body: string;
  private _audience: AnnouncementAudience;
  private _isPinned: boolean;
  readonly publishedAt: Date;
  private _expiresAt: Date | null;

  private constructor(props: AnnouncementProps) {
    super(props);
    this.buildingId = props.buildingId;
    this._title = props.title;
    this._body = props.body;
    this._audience = props.audience;
    this._isPinned = props.isPinned;
    this.publishedAt = props.publishedAt;
    this._expiresAt = props.expiresAt;
  }

  static publish(
    tenantId: string,
    input: {
      buildingId?: string | null;
      title: string;
      body: string;
      audience?: AnnouncementAudience;
      isPinned?: boolean;
      publishedAt?: Date;
      expiresAt?: Date | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Announcement {
    invariant(input.title.trim().length >= 3, 'ANNOUNCEMENT_TITLE', 'Title is required');
    invariant(input.body.trim().length >= 3, 'ANNOUNCEMENT_BODY', 'Body is required');
    const now = clock.now();
    const publishedAt = input.publishedAt ?? now;
    invariant(
      input.expiresAt == null || input.expiresAt.getTime() > publishedAt.getTime(),
      'ANNOUNCEMENT_EXPIRY',
      'Expiry must be after the publish time',
    );
    return new Announcement({
      ...newEntityProps(newId(), tenantId, actorId, now),
      buildingId: input.buildingId ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience ?? 'All',
      isPinned: input.isPinned ?? false,
      publishedAt,
      expiresAt: input.expiresAt ?? null,
    });
  }

  static restore(props: AnnouncementProps): Announcement {
    return new Announcement(props);
  }

  get title(): string {
    return this._title;
  }
  get body(): string {
    return this._body;
  }
  get audience(): AnnouncementAudience {
    return this._audience;
  }
  get isPinned(): boolean {
    return this._isPinned;
  }
  get expiresAt(): Date | null {
    return this._expiresAt;
  }

  isVisible(asOf: Date): boolean {
    return (
      !this.isDeleted && (this._expiresAt === null || this._expiresAt.getTime() > asOf.getTime())
    );
  }

  pin(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._isPinned = true;
    this.touch(actorId, clock.now());
  }
  unpin(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    this._isPinned = false;
    this.touch(actorId, clock.now());
  }

  edit(
    changes: Partial<{ title: string; body: string }>,
    actorId: string | null,
    clock: IClock,
  ): void {
    this.assertNotDeleted();
    if (changes.title !== undefined) {
      invariant(changes.title.trim().length >= 3, 'ANNOUNCEMENT_TITLE', 'Title is required');
      this._title = changes.title.trim();
    }
    if (changes.body !== undefined) {
      invariant(changes.body.trim().length >= 3, 'ANNOUNCEMENT_BODY', 'Body is required');
      this._body = changes.body.trim();
    }
    this.touch(actorId, clock.now());
  }

  toProps(): AnnouncementProps {
    return {
      ...this.entityProps(),
      buildingId: this.buildingId,
      title: this._title,
      body: this._body,
      audience: this._audience,
      isPinned: this._isPinned,
      publishedAt: this.publishedAt,
      expiresAt: this._expiresAt,
    };
  }
}

/* -------------------------- Notification ------------------------ */

export interface NotificationProps extends EntityProps {
  recipientUserId: string;
  title: string;
  body: string | null;
  category: NotificationCategory;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
}

/** Aggregate root: an in-app notification delivered to one user. */
export class Notification extends AggregateRoot {
  readonly recipientUserId: string;
  readonly title: string;
  readonly body: string | null;
  readonly category: NotificationCategory;
  readonly relatedEntityType: string | null;
  readonly relatedEntityId: string | null;
  private _isRead: boolean;
  private _readAt: Date | null;

  private constructor(props: NotificationProps) {
    super(props);
    this.recipientUserId = props.recipientUserId;
    this.title = props.title;
    this.body = props.body;
    this.category = props.category;
    this.relatedEntityType = props.relatedEntityType;
    this.relatedEntityId = props.relatedEntityId;
    this._isRead = props.isRead;
    this._readAt = props.readAt;
  }

  static create(
    tenantId: string,
    input: {
      recipientUserId: string;
      title: string;
      body?: string | null;
      category?: NotificationCategory;
      relatedEntityType?: string | null;
      relatedEntityId?: string | null;
    },
    actorId: string | null,
    clock: IClock,
  ): Notification {
    invariant(input.title.trim().length > 0, 'NOTIFICATION_TITLE', 'Title is required');
    return new Notification({
      ...newEntityProps(newId(), tenantId, actorId, clock.now()),
      recipientUserId: input.recipientUserId,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      category: input.category ?? 'System',
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      isRead: false,
      readAt: null,
    });
  }

  static restore(props: NotificationProps): Notification {
    return new Notification(props);
  }

  get isRead(): boolean {
    return this._isRead;
  }
  get readAt(): Date | null {
    return this._readAt;
  }

  markRead(actorId: string | null, clock: IClock): void {
    this.assertNotDeleted();
    if (this._isRead) return; // idempotent
    const now = clock.now();
    this._isRead = true;
    this._readAt = now;
    this.touch(actorId, now);
  }

  toProps(): NotificationProps {
    return {
      ...this.entityProps(),
      recipientUserId: this.recipientUserId,
      title: this.title,
      body: this.body,
      category: this.category,
      relatedEntityType: this.relatedEntityType,
      relatedEntityId: this.relatedEntityId,
      isRead: this._isRead,
      readAt: this._readAt,
    };
  }
}
