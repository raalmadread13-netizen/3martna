# ADR-0005 — No seeded admin; bootstrap the first SuperAdmin via CLI

**Status:** Accepted (Sprint 3, CTO change request)

## Context

Sprint 2 seeded a default SuperAdmin (`admin@3martna.jo` / `Password123!`) so
the platform was usable immediately. A permanent, well-known admin account
baked into migrations/seeds is a critical security liability: the credentials
are public in source control and are easy to forget to change before launch.

## Decision

**No admin account exists in any migration or seed.** The identity seed
(`0001_identity_seed.sql`) contains reference data only — roles and the
permission catalog.

The first SuperAdmin is created by an interactive one-time CLI:

```bash
npm run bootstrap:admin
```

- Prompts for first name, last name, email, phone and a hidden password.
- Enforces the password policy and hashes with bcrypt (cost 12).
- **Refuses to run if any SuperAdmin already exists** (`SUPERADMIN_EXISTS`) —
  it is a bootstrap, not a user-management tool.
- **Development-first:** in `NODE_ENV=production` it aborts unless
  `ALLOW_PRODUCTION_BOOTSTRAP=true` is set **and** the operator types an
  explicit confirmation phrase (`BOOTSTRAP <DBNAME>`).

The logic lives in the `BootstrapSuperAdmin` application use-case (unit
tested); the CLI is a thin presentation adapter in `presentation/cli/`.

## Consequences

- ✅ No known credentials ever ship in the repository.
- ✅ The "only one SuperAdmin can be bootstrapped" guard prevents accidental or
  malicious privilege seeding.
- ✅ Production requires deliberate, auditable confirmation.
- ⚠️ A fresh environment is unusable until an operator runs the command — an
  acceptable, documented one-time step (installation guide).
