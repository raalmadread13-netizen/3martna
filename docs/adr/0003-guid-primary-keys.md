# ADR-0003 — GUID primary keys for all entities

**Status:** Accepted (Sprint 3, CTO change request)

## Context

Sprint 1–2 used `INT IDENTITY` primary keys. The platform must support many
buildings across many companies, offline-capable clients, and future
cross-instance synchronization. Sequential integer keys:

- collide across databases/instances, blocking merge/sync;
- leak volume and are trivially enumerable in URLs;
- force a DB round-trip before a new record's identity is known.

## Decision

Every primary key is a **GUID (`UNIQUEIDENTIFIER`)**.

- SQL Server columns default to `NEWSEQUENTIALID()` — index-friendly
  (near-sequential, low fragmentation) while remaining globally unique.
- The application generates ids up-front with `crypto.randomUUID()`
  (`newId()` in the domain), so an aggregate has its identity before the
  INSERT round-trip.
- All foreign keys, DTO ids, and JWT `sub`/`tenantId` claims are strings.

Because no environment had been provisioned yet, migration `0001_identity.sql`
was **rewritten in place** as a GUID baseline rather than shipping a fragile
INT→GUID data migration. Existing development databases must be dropped and
re-provisioned (documented in `database/README.md`).

## Consequences

- ✅ Global uniqueness enables multi-instance sync and safe data export/import.
- ✅ Non-enumerable identifiers in URLs and payloads.
- ✅ Identity known before persistence simplifies aggregate construction.
- ⚠️ 16-byte keys are larger than 4-byte ints (wider indexes); mitigated by
  `NEWSEQUENTIALID()` to avoid page splits.
- ⚠️ The 0001 baseline rewrite is a one-time, pre-launch exception to the
  otherwise append-only migration rule.
