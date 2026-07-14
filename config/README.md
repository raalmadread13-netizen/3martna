# config/

Configuration strategy for every environment. **No secrets are ever
committed** — this folder holds templates and placement instructions only.

## Where configuration lives

| App | Template | Runtime source |
|---|---|---|
| backend | `backend/.env.example` | `.env` locally · env vars on Railway/Render |
| mobile | `mobile/.env.example` | `.env` locally · EAS build profiles in CI |

Copy the template, fill in real values, never commit the result:

```bash
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

Variable-by-variable reference: [docs/ENVIRONMENT.md](../docs/ENVIRONMENT.md)

## Firebase files

| File | Put it at | Notes |
|---|---|---|
| Service-account JSON | `FIREBASE_SERVICE_ACCOUNT` env var (one line) | backend only — a real secret |
| `google-services.json` | `mobile/google-services.json` | gitignored; wired in `app.json` when push lands |
| `GoogleService-Info.plist` | `mobile/GoogleService-Info.plist` | gitignored |

## Secret generation

```bash
# JWT secrets
openssl rand -base64 48
```

Production secrets belong in the host's secret manager (Railway/Render
variables, EAS secrets) — never in files, never in this repository.
