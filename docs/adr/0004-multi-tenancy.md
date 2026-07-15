# ADR-0004 — Shared-schema multi-tenancy with a TenantId discriminator

**Status:** Accepted (Sprint 3)

## Context

3martna serves many independent customers — property-management companies,
owners' associations, individual landlords. Each customer's data (buildings,
residents, finances) must be strictly isolated from every other's. The three
common models are: database-per-tenant, schema-per-tenant, and a shared schema
with a tenant discriminator column.

## Decision

**Shared schema, discriminator column.** Every business row carries a
`TenantId` (GUID) FK to `dbo.Tenants`.

- A `Tenants` table is the tenancy anchor; `Users.TenantId` links accounts to a
  tenant (nullable only for platform-level SuperAdmins).
- **Isolation is a repository responsibility:** every business repository
  method takes a `tenantId` and MUST filter by it (`ITenantRepository<T>`).
  No query can implicitly cross tenants.
- Tenant-scoped uniqueness uses **filtered composite indexes**, e.g.
  `UQ_Buildings_Tenant_Name (TenantId, Name) WHERE IsDeleted = 0` — names are
  unique within a tenant, not globally.
- Hot-path indexes **lead with `TenantId`** so every access pattern is
  partition-aligned.
- The access token carries `tenantId`; the application derives tenant scope
  from the authenticated principal, never from client-supplied input.

## Consequences

- ✅ One schema, one migration stream, one connection pool — operationally
  simple and cost-effective for a pilot and early growth.
- ✅ Cross-tenant analytics remain possible for platform administration.
- ✅ GUID tenant ids (ADR-0003) allow a future lift-and-shift of a large tenant
  into its own database without id collisions.
- ⚠️ Isolation is enforced in code, not by physical separation — mitigated by
  the mandatory `tenantId` parameter on every repository method and by
  integration tests. A future high-security tenant can be migrated to
  database-per-tenant without domain changes.
- ⚠️ A missing tenant filter is a serious defect class — repository
  implementations (later sprint) will centralize the filter in a base class so
  it cannot be forgotten per query.
