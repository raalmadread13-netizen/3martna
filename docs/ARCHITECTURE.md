# Architecture

3martna uses **Clean Architecture** in both applications. The goal: business
rules that survive framework churn, and features that can be added without
touching unrelated code.

## Layer model

```
┌────────────────────────────────────────────────────────┐
│  Presentation      Express HTTP · React Native screens │
│      │  calls                                          │
│  Application       use-cases · service interfaces      │
│      │  depends on                                     │
│  Domain            entities · repository contracts     │
│      ▲  implemented by                                 │
│  Infrastructure    SQL Server · Firebase · JWT · bcrypt│
│                    · winston · axios · SecureStore     │
└────────────────────────────────────────────────────────┘
         Shared: config · errors · pure types/utils
```

**The dependency rule:** source code dependencies only point inward.
Domain knows nothing about SQL Server; use-cases know nothing about Express;
screens know nothing about axios.

## Backend (`backend/src/`)

| Layer | Folder | Contents (Sprint 1) |
|---|---|---|
| Domain | `domain/` | `BaseEntity`, `IRepository<T>` contract |
| Application | `application/` | `GetHealthStatus` use-case; `ILogger`, `IPasswordHasher`, `ITokenService` interfaces |
| Infrastructure | `infrastructure/` | SQL Server connection + migration/seed runners, Firebase Admin, winston logger, `BcryptPasswordHasher`, `JwtTokenService` |
| Presentation | `presentation/http/` | Express app/server, routes, controllers, middleware (auth, validation, rate limit, errors), Swagger |
| Shared | `shared/` | validated env config, `AppError`, API envelope types |

Request lifecycle:

```
HTTP → helmet/cors → parsing → requestLogger → route
     → validate(Joi) → [authenticate/authorize] → controller
     → use-case → repository interface → SQL Server (stored procedures)
     → response envelope | errorHandler (single funnel for all errors)
```

Conventions:

- **One use-case per file**, constructor-injected dependencies (interfaces).
- **Repositories**: interface in `domain/repositories`, SQL implementation in
  `infrastructure/database/repositories` (arrives with first feature sprint).
- **All data access through parameterized stored procedures** — the driver
  binds every value; no SQL string concatenation, ever.
- **Path aliases**: `@domain/*`, `@application/*`, `@infrastructure/*`,
  `@presentation/*`, `@shared/*`.

## Mobile (`mobile/src/`)

| Layer | Folder | Contents (Sprint 1) |
|---|---|---|
| Presentation | `presentation/` | screens, navigation, themed UI components, ThemeProvider (light/dark/system, persisted) |
| Application | `application/hooks/` | `useAppBootstrap` (splash orchestration) |
| Domain | `domain/` | reserved for entities (feature sprints) |
| Infrastructure | `infrastructure/` | axios client (token interceptor), SecureStore wrapper, Firebase JS SDK init, push-notification plumbing |
| Shared | `shared/` | env config, constants, pure utils |

Path alias: `@/*` → `src/*` (tsconfig + babel module-resolver).

## Database

- Forward-only numbered SQL migrations (`database/migrations/NNNN_*.sql`),
  applied transactionally and tracked in `dbo._MigrationsHistory`.
- Idempotent seeds in `database/seeds/`.
- Connection pooling via `mssql`, lazily created; the API boots without a
  database when `DB_HOST` is empty (CI, early sprints).

## Cross-cutting decisions

| Decision | Rationale |
|---|---|
| JWT access (15 min) + opaque rotating refresh tokens (SHA-256 stored) | Leaked DB rows can't be replayed; short access window |
| bcrypt cost 12 | Industry baseline for 2026 hardware |
| Single error funnel (`AppError` → `errorHandler`) | Uniform envelopes, no leaked stack traces in production |
| Env validated at boot, secrets required in production | Fail fast, no guessable defaults |
| Firebase optional-by-config | Local dev and CI run with zero cloud dependencies |

## Authentication & Identity (Sprint 2)

**SQL Server is the only source of truth** for users, roles, permissions and
sessions. Firebase never manages identity — it is reserved for push
notifications, storage and future messaging.

### Data model (`database/migrations/0001_identity.sql`)

`Users`, `Roles`, `Permissions`, `RolePermissions`, `UserRoles`,
`RefreshTokens`, `VerificationCodes`, `AuditLogs` — every table carries
`Id, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsDeleted, RowVersion`,
soft deletes with filtered unique indexes, and FKs across the identity graph.
`Users.TenantId` (nullable) provides multi-tenant readiness; the Tenants
table + FK arrive with the tenancy sprint.

### Token model

- **Access token** — JWT, 15 min, carries `sub`, `roles`, `permissions`
  (resolved from the database at issue time) and `tenantId`.
- **Refresh token** — opaque 256-bit value; only its SHA-256 hash is stored.
  Every use **rotates** the token; presenting an already-rotated token is
  treated as theft and revokes every session for that user (reuse detection).
- Password change / reset revokes all refresh tokens.

### Authorization

Permission-based: `requirePermission('users.manage')` checks codes that live
in `dbo.Permissions` and reach the request via the access token. Nothing is
hardcoded — new permissions are seed rows, and SuperAdmin receives every
permission via the seed's cross join.

### Brute force & enumeration defences

- Strict rate limit on credential endpoints (`AUTH_RATE_LIMIT_MAX`).
- Account lockout after `AUTH_MAX_FAILED_LOGINS` failures for
  `AUTH_LOCKOUT_MINUTES` (tracked on the Users row).
- One generic `INVALID_CREDENTIALS` error for wrong password *and* unknown
  user, with a dummy bcrypt comparison to equalize response timing.
- Forgot-password always returns the same acknowledgement.
- Verification codes: hashed at rest, single-use, TTL-bound, 5 attempts max.

### Auth flow wiring

```
routes (Joi validation, rate limits, Swagger)
  → auth.controller → container (composition root)
  → use-cases: RegisterUser · LoginUser · RefreshSession · LogoutUser ·
               ChangePassword · ForgotPassword · ResetPassword ·
               RequestVerification · ConfirmVerification · GetCurrentUser
  → repository interfaces → SQL Server (parameterized queries)
```

The composition root (`presentation/http/container.ts`) exposes a test seam
(`setContainer`) so the entire HTTP surface is integration-tested against
in-memory repositories — no database needed in CI.

### Mobile session lifecycle

`AuthProvider` (application layer) restores the session on launch
(auto-login), stores tokens exclusively in encrypted SecureStore, and the
axios client transparently rotates refresh tokens on 401 with a shared
refresh queue. Navigation is auth-aware: the mounted stack follows the
session state, so screens never navigate across the auth boundary.

## Core Domain Model & Multi-Tenancy (Sprint 3)

Sprint 3 designed the business heart of the platform — **schema, rich domain,
and contracts only** (no APIs, controllers or CRUD yet).

### CTO change requests (applied first)

1. **GUID primary keys everywhere** (ADR-0003) — all keys are
   `UNIQUEIDENTIFIER`; ids are string-typed end to end (domain, DTOs, JWT).
2. **No seeded admin** (ADR-0005) — the identity seed holds reference data
   only; the first SuperAdmin is created by `npm run bootstrap:admin`
   (dev-only, explicit production confirmation).
3. **Standard columns on every business table** — `TenantId`, `CreatedAt`,
   `UpdatedAt`, `CreatedBy`, `UpdatedBy`, `IsDeleted`, `RowVersion`.

### Multi-tenancy (ADR-0004)

Shared schema with a `TenantId` discriminator; a `Tenants` table anchors
tenancy. Isolation is a **repository responsibility**: every business
repository method takes a `tenantId` and filters by it
(`ITenantRepository<T>`). Tenant-scoped uniqueness uses filtered composite
indexes; hot-path indexes lead with `TenantId`.

### Rich domain model (ADR-0006)

`domain/business/` holds 22 framework-independent entities across aggregates
(Building, Apartment, Owner, Resident, LeaseContract, Invoice, Payment,
MaintenanceRequest, Complaint, Visitor/VisitorAccess, …) built on
`domain/common` (`Entity`, `DomainError`, `Money`, `DateRange`). Fields are
private; state changes go through intention-revealing methods and explicit
state machines; construction validates via static factories. Full walk-through
with diagrams: [DOMAIN.md](DOMAIN.md) and [ER_DIAGRAM.md](ER_DIAGRAM.md).

### Contracts, not implementations

This sprint ships repository **interfaces**
(`domain/repositories/business/`), **DTOs** (`application/dtos/`) and
**mapping profiles** (`application/mappers/`, entity → DTO one-directional).
SQL repository implementations, use-cases and HTTP endpoints follow in later
sprints against these stable contracts.

### Two audit trails

`AuditLog` (identity domain, Sprint 2) is the **security** trail. `ActivityLog`
(business domain, Sprint 3) is the user-visible **product activity** feed. They
are intentionally separate.

## Adding a feature (the recipe every sprint follows)

1. Migration(s) in `database/migrations/` + stored procedures.
2. Entity + repository interface in `domain/`.
3. Repository implementation in `infrastructure/database/repositories/`.
4. Use-cases in `application/use-cases/`.
5. Routes + controller + Joi schemas in `presentation/http/`.
6. Mobile: service in `infrastructure/api/`, hook in `application/hooks/`,
   screens in `presentation/screens/`.
7. Tests at each boundary.
