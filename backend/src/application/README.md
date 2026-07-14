# Application Layer

Use-cases (interactors) and the service **interfaces** they depend on.

Rules:

- Depends on `@domain` and `@shared` only. Never on Express or concrete
  infrastructure (`GetHealthStatus` references the connection module's pure
  status flag — the single allowed diagnostic exception).
- One use-case class per file, named after the action
  (`CreateBuilding`, `RecordPayment`, ...).
- Infrastructure implements the interfaces in `interfaces/`
  (`ILogger`, `IPasswordHasher`, `ITokenService`).

Feature use-cases arrive in later sprints.
