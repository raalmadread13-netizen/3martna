import { newId } from '@domain/common/identity';

/**
 * A domain event: a fact that has happened in the domain, worth reacting to.
 * Sprint-4-CTO-patch prepares the infrastructure only — events are collected
 * on aggregates but not yet dispatched to handlers or messaging (ADR-0008).
 */
export interface IDomainEvent {
  /** Unique event id (GUID). */
  readonly eventId: string;
  /** Stable event type name, e.g. 'lease.activated'. */
  readonly eventType: string;
  /** When the event occurred (supplied via IClock — never the wall clock). */
  readonly occurredAt: Date;
  /** Tenant the event belongs to (multi-tenant routing). */
  readonly tenantId: string;
  /** Id of the aggregate that raised the event. */
  readonly aggregateId: string;
  /** Serializable payload — must contain no secrets. */
  readonly payload: Record<string, unknown>;
}

/** Base class for concrete domain events. */
export abstract class DomainEvent implements IDomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;

  protected constructor(
    readonly eventType: string,
    readonly tenantId: string,
    readonly aggregateId: string,
    readonly payload: Record<string, unknown>,
    occurredAt: Date,
  ) {
    this.eventId = newId();
    this.occurredAt = occurredAt;
  }
}
