# Architecture Decision Records

Each ADR captures one significant decision: its context, the choice, and its
consequences. ADRs are immutable once accepted — a reversal is a new ADR that
supersedes the old one.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-clean-architecture.md) | Clean Architecture with strict layer boundaries | Accepted (Sprint 1) |
| [0002](0002-sql-server-single-source-of-truth.md) | SQL Server is the only identity source; Firebase is not | Accepted (Sprint 2) |
| [0003](0003-guid-primary-keys.md) | GUID primary keys for all entities | Accepted (Sprint 3) |
| [0004](0004-multi-tenancy.md) | Shared-schema multi-tenancy with a TenantId discriminator | Accepted (Sprint 3) |
| [0005](0005-no-seeded-admin-bootstrap-cli.md) | No seeded admin; bootstrap the first SuperAdmin via CLI | Accepted (Sprint 3) |
| [0006](0006-rich-domain-model.md) | Rich domain model with aggregate roots | Accepted (Sprint 3) |
