import { AggregateRoot } from '@domain/common/AggregateRoot';
import { EntityProps, newEntityProps } from '@domain/common/Entity';
import { DomainEvent } from '@domain/common/events/IDomainEvent';
import { Building } from '@domain/business/Building';
import { FakeClock } from './support/FakeClock';

/* A concrete event + a tiny aggregate to exercise the base mechanics. */
class ThingRenamed extends DomainEvent {
  constructor(tenantId: string, aggregateId: string, name: string, occurredAt: Date) {
    super('thing.renamed', tenantId, aggregateId, { name }, occurredAt);
  }
}

interface ThingProps extends EntityProps {
  name: string;
}

class Thing extends AggregateRoot {
  private _name: string;
  constructor(props: ThingProps) {
    super(props);
    this._name = props.name;
  }
  static create(tenantId: string, name: string, clock: FakeClock): Thing {
    return new Thing({ ...newEntityProps('id-1', tenantId, null, clock.now()), name });
  }
  rename(name: string, clock: FakeClock): void {
    const now = clock.now();
    this._name = name;
    this.touch(null, now); // protected — accessible to subclasses
    this.raise(new ThingRenamed(this.tenantId, this.id, name, now));
  }
  get name(): string {
    return this._name;
  }
}

describe('AggregateRoot domain-event collection', () => {
  const clock = new FakeClock();

  it('collects raised events and pulls them once', () => {
    const thing = Thing.create('tenant-1', 'a', clock);
    expect(thing.domainEvents).toHaveLength(0);

    thing.rename('b', clock);
    thing.rename('c', clock);
    expect(thing.domainEvents).toHaveLength(2);

    const pulled = thing.pullDomainEvents();
    expect(pulled).toHaveLength(2);
    expect(pulled[0].eventType).toBe('thing.renamed');
    expect(pulled[0].tenantId).toBe('tenant-1');
    expect(pulled[0].payload).toEqual({ name: 'b' });
    // Pull is draining — a second pull is empty
    expect(thing.pullDomainEvents()).toHaveLength(0);
  });

  it('clearDomainEvents discards without dispatching', () => {
    const thing = Thing.create('tenant-1', 'a', clock);
    thing.rename('b', clock);
    thing.clearDomainEvents();
    expect(thing.domainEvents).toHaveLength(0);
  });

  it('real aggregate roots expose an (initially empty) event stream', () => {
    const building = Building.create(
      'tenant-1',
      { name: 'Tower A', address: '10 King St', city: 'Amman', totalFloors: 4 },
      'user-1',
      clock,
    );
    // No events raised yet (Sprint-4-CTO-patch prepares infra only)
    expect(building.domainEvents).toHaveLength(0);
    expect(building.pullDomainEvents()).toEqual([]);
  });
});
