import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { invariant } from '@domain/common/DomainError';
import { newId } from '@domain/common/identity';
import { IClock } from '@domain/common/time/IClock';

export interface ActivityLogProps extends EntityProps {
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

/**
 * Aggregate root: the business-facing activity feed (who did what, per
 * tenant). Distinct from the security AuditLog (migration 0001): this is
 * user-visible product history. Append-only — created, never mutated.
 */
export class ActivityLog extends AggregateRoot {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly summary: string;
  readonly metadata: Record<string, unknown> | null;
  readonly occurredAt: Date;

  private constructor(props: ActivityLogProps) {
    super(props);
    this.actorUserId = props.actorUserId;
    this.action = props.action;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.summary = props.summary;
    this.metadata = props.metadata;
    this.occurredAt = props.occurredAt;
  }

  static record(
    tenantId: string,
    input: {
      actorUserId?: string | null;
      action: string;
      entityType?: string | null;
      entityId?: string | null;
      summary: string;
      metadata?: Record<string, unknown> | null;
      occurredAt?: Date;
    },
    actorId: string | null,
    clock: IClock,
  ): ActivityLog {
    invariant(input.action.trim().length > 0, 'ACTIVITY_ACTION', 'Action is required');
    invariant(input.summary.trim().length > 0, 'ACTIVITY_SUMMARY', 'Summary is required');
    const now = clock.now();
    return new ActivityLog({
      ...newEntityProps(newId(), tenantId, actorId, now),
      actorUserId: input.actorUserId ?? null,
      action: input.action.trim(),
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary.trim(),
      metadata: input.metadata ?? null,
      occurredAt: input.occurredAt ?? now,
    });
  }

  static restore(props: ActivityLogProps): ActivityLog {
    return new ActivityLog(props);
  }

  toProps(): ActivityLogProps {
    return {
      ...this.entityProps(),
      actorUserId: this.actorUserId,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
      summary: this.summary,
      metadata: this.metadata,
      occurredAt: this.occurredAt,
    };
  }
}
