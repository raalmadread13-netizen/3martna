# Environment Variables

No secrets are committed anywhere in this repository. Templates live at
`backend/.env.example` and `mobile/.env.example`.

## Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | – | `development` | `development` · `test` · `production` |
| `PORT` | – | `4000` | HTTP port |
| `API_PREFIX` | – | `/api/v1` | Versioned API mount point |
| `CORS_ORIGINS` | – | `http://localhost:5173` | Comma-separated browser origins |
| `DB_HOST` | – | *(empty)* | SQL Server host. **Empty = boot without a database** |
| `DB_PORT` | – | `1433` | |
| `DB_NAME` | – | `Amartna` | |
| `DB_USER` | – | `sa` | |
| `DB_PASSWORD` | with DB | – | |
| `DB_ENCRYPT` | – | `false` | `true` for Azure SQL / TLS-enforced servers |
| `DB_TRUST_SERVER_CERT` | – | `true` | `true` for local containers |
| `DB_POOL_MAX` | – | `10` | Connection pool ceiling |
| `JWT_ACCESS_SECRET` | **prod** | dev fallback | `openssl rand -base64 48` — process refuses to boot in production without it |
| `JWT_REFRESH_SECRET` | **prod** | dev fallback | Different value from access secret |
| `JWT_ACCESS_EXPIRES` | – | `15m` | Access-token lifetime |
| `JWT_REFRESH_EXPIRES_DAYS` | – | `30` | Refresh-token lifetime |
| `RATE_LIMIT_WINDOW_MINUTES` | – | `15` | Rate-limit window |
| `RATE_LIMIT_MAX` | – | `300` | Requests per window per IP |
| `FIREBASE_SERVICE_ACCOUNT` | – | *(empty)* | Full service-account JSON, one line. Empty = Firebase disabled |
| `FIREBASE_STORAGE_BUCKET` | with FB | – | `your-project.appspot.com` |
| `FIREBASE_DATABASE_URL` | with FB | – | Realtime Database URL |
| `LOG_LEVEL` | – | `info` | winston level |

## Mobile (`mobile/.env`)

`EXPO_PUBLIC_*` values are **bundled into the app binary** — public
identifiers only, never secrets.

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL (LAN IP for physical devices) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase web config (public) |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL` | Realtime Database URL |

## Production placement

- **Railway/Render (backend)**: dashboard environment variables.
- **EAS (mobile)**: `eas secret` / build-profile `env` blocks.
- Rotate `JWT_*` secrets on any suspicion of leakage; rotating the refresh
  secret invalidates all sessions by design.
