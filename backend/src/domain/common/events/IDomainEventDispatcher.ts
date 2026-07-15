import { IDomainEvent } from './IDomainEvent';

/**
 * Publishing abstraction: hands collected domain events to the outside world.
 * The Sprint-4-CTO-patch ships the interfaces only; concrete in-process and
 * outbox-backed publishers arrive in a later sprint (ADR-0008).
 */
export interface IDomainEventPublisher {
  publish(events: readonly IDomainEvent[]): Promise<void>;
}

/**
 * Orchestrates dispatch after an aggregate is persisted: pulls events off the
 * saved aggregates and forwards them to a publisher. No handler registry and
 * no messaging integration yet — this is the seam future wiring plugs into.
 */
export interface IDomainEventDispatcher {
  dispatch(events: readonly IDomainEvent[]): Promise<void>;
}
