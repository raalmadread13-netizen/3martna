# Installation Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS+ | `node -v` |
| npm | 10+ | ships with Node |
| Docker | any recent | easiest way to run SQL Server locally |
| Expo Go app | latest | on your Android/iOS test device |

## 1. Clone & bootstrap

```bash
git clone <repo-url> 3martna && cd 3martna
./scripts/setup.sh        # creates .env files + installs all dependencies
```

(Or do it manually: `cp <app>/.env.example <app>/.env && npm install` inside
`backend/` and `mobile/`.)

## 2. SQL Server (optional in Sprint 1)

The API boots without a database when `DB_HOST` is empty. To run with one:

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" \
  -p 1433:1433 --name martna-sql -d mcr.microsoft.com/mssql/server:2022-latest

docker exec -it martna-sql /opt/mssql-tools/bin/sqlcmd -U sa -P 'YourStrong!Passw0rd' \
  -Q "IF DB_ID('Amartna') IS NULL CREATE DATABASE Amartna;"
```

Then set the `DB_*` values in `backend/.env` and run:

```bash
cd backend
npm run db:migrate     # applies database/migrations (none yet in Sprint 1)
npm run db:seed        # applies database/seeds
```

## 3. Backend

```bash
cd backend
npm run dev
# → http://localhost:4000/health        {"status":"ok"}
# → http://localhost:4000/api/docs      Swagger UI
```

## 4. Mobile

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).
If testing against your local backend from a physical device, set
`EXPO_PUBLIC_API_URL` in `mobile/.env` to your machine's LAN IP, e.g.
`http://192.168.1.20:4000`.

## 5. Firebase (optional in Sprint 1)

1. Create a Firebase project at console.firebase.google.com.
2. **Backend**: create a service account key, paste the JSON (single line)
   into `FIREBASE_SERVICE_ACCOUNT` in `backend/.env`.
3. **Mobile**: add a Web App in Firebase, copy the public config into the
   `EXPO_PUBLIC_FIREBASE_*` values in `mobile/.env`.

Everything runs without Firebase until the notification/chat sprints.

## 6. Verify the installation

```bash
./scripts/check.sh
```

Expected: every check green — backend typecheck/lint/format/tests and
mobile typecheck/lint/format.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required environment variable` on boot | You're in `NODE_ENV=production` without real secrets — set them or use development |
| Backend can't reach SQL Server | Check `docker ps`, port 1433, `DB_TRUST_SERVER_CERT=true` for local |
| Expo device can't reach API | Use LAN IP, not `localhost`; same Wi-Fi network |
| Metro cache weirdness after dependency changes | `npx expo start -c` |
