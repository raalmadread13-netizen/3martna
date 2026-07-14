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

## Adding a feature (the recipe every sprint follows)

1. Migration(s) in `database/migrations/` + stored procedures.
2. Entity + repository interface in `domain/`.
3. Repository implementation in `infrastructure/database/repositories/`.
4. Use-cases in `application/use-cases/`.
5. Routes + controller + Joi schemas in `presentation/http/`.
6. Mobile: service in `infrastructure/api/`, hook in `application/hooks/`,
   screens in `presentation/screens/`.
7. Tests at each boundary.
