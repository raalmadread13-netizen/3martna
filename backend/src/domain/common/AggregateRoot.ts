import { Entity, EntityProps } from './Entity';
import { IDomainEvent } from './events/IDomainEvent';

/**
 * Base class for aggregate roots (ADR-0008). Adds domain-event collection on
 * top of `Entity`: roots record events via `raise()` during business
 * operations; the application layer `pullDomainEvents()` after a successful
 * `save()` and forwards them to a publisher.
 *
 * Events are transient — never persisted on the aggregate, never included in
 * `toProps()`. Child entities (e.g. Floor) extend `Entity`, not this class:
 * only roots own an event stream.
 */
export abstract class AggregateRoot extends Entity {
  private _domainEvents: IDomainEvent[] = [];

  protected constructor(props: EntityProps) {
    super(props);
  }

  /** Record a domain event that happened during a business operation. */
  protected raise(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Events collected since load/creation (read-only view). */
  get domainEvents(): readonly IDomainEvent[] {
    return this._domainEvents;
  }

  /** Return and clear the collected events (called after a successful save). */
  pullDomainEvents(): IDomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  /** Discard collected events without dispatching (e.g. on rollback). */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
