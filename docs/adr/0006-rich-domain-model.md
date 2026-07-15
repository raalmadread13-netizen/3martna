# ADR-0006 — Rich domain model with aggregate roots

**Status:** Accepted (Sprint 3)

## Context

The core business logic (leasing, billing, maintenance, visitor access) has
non-trivial invariants and lifecycles. An anemic model — plain data bags plus
service classes that mutate them — scatters those rules across the codebase and
lets any caller put an entity into an illegal state. The CTO brief mandated a
**rich domain model, no anemic models, business rules inside the domain.**

## Decision

Model the business as **aggregates with rich entities** in
`domain/business/`, framework-independent (no ORM, no Express, no SQL):

- **Encapsulation:** entity fields are private; state changes happen only
  through intention-revealing methods (`lease.activate()`,
  `invoice.recordPayment()`, `request.assign()`), never by setting a status
  field directly.
- **Invariants live in the entity:** construction goes through static factories
  (`LeaseContract.draft`, `Invoice.draft`, …) that validate inputs and throw
  `DomainError`; illegal state transitions are rejected by explicit state
  machines.
- **Aggregate roots** own their consistency boundary. A root loads and saves as
  a unit; other aggregates are referenced **by id only**, never by object
  reference. Example: `Building` owns `Floor`/`ParkingSpace`/`StorageUnit`;
  `Apartment` is its own aggregate (high contention) referenced by id.
- **Value objects** (`Money`, `DateRange`) are immutable and self-validating;
  money arithmetic refuses cross-currency operations.
- **Base `Entity`** carries the standard columns (`id`, `tenantId`, audit
  stamps, `isDeleted`, `rowVersion`) and the `touch`/`softDelete` mechanics, so
  every entity is consistent by construction.
- **Persistence mapping** is one-directional in the app layer: entity →
  `toProps()` → DTO. Rehydration uses each entity's `restore()` factory, so
  reconstruction stays in the domain.

Repositories are defined as **interfaces only** this sprint
(`domain/repositories/business/`); SQL implementations and use-cases arrive in
later sprints against these stable contracts.

## Consequences

- ✅ Illegal states are unrepresentable — e.g. an invoice can't be paid before
  it is issued, a lease can't be terminated from Draft, a complaint marked
  anonymous never stores a submitter id.
- ✅ Business rules are unit-testable with zero infrastructure (59 backend tests
  run with no database).
- ✅ Swapping persistence or transport touches only the outer layers.
- ⚠️ More boilerplate than anemic classes (private fields, factories, mappers) —
  justified by the correctness guarantees for money- and contract-bearing
  flows.
- ⚠️ Aggregate boundaries must be respected in later sprints: cross-aggregate
  consistency is eventual/orchestrated by use-cases, not enforced by FKs alone.
