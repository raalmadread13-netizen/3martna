# 3martna (عمارتنا) — MVP Demo Guide

How to install, run and demo the MVP end-to-end. Verified in Sprint 6.5:
the complete workflow below passes against a running backend
(30 automated end-to-end checks).

---

## 1. Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Node.js | ≥ 20 | backend + mobile |
| npm | ≥ 10 | |
| Docker | any recent | only for SQL Server (optional in DEMO mode) |
| Expo Go app | latest | on your iOS/Android phone, or use an emulator |

Clone and install:

```bash
git clone <repo-url> 3martna && cd 3martna
cd backend && npm install
cd ../mobile && npm install
```

---

## 2. Fastest path — DEMO mode (no SQL Server)

The backend can run entirely on in-memory repositories, pre-seeded with
the demo portfolio. Real bcrypt, real JWTs, all business rules — only
persistence is swapped. Data resets on every restart.

```bash
cd backend
DEMO_MODE=true npm run dev
```

The boot log prints the demo credentials. Verify:

```bash
curl http://localhost:4000/health          # {"status":"ok"}
open http://localhost:4000/api/docs        # Swagger UI (all 33 endpoints)
```

---

## 3. Full path — SQL Server

### 3.1 Run SQL Server (Docker)

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Pass123" \
  -p 1433:1433 --name 3martna-sql -d mcr.microsoft.com/mssql/server:2022-latest
docker exec 3martna-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
  -P 'YourStrong!Pass123' -C -Q "CREATE DATABASE Amartna"
```

### 3.2 Configure the backend

```bash
cd backend && cp .env.example .env
```

Set in `.env`:

```
DB_HOST=localhost
DB_PORT=1433
DB_NAME=Amartna
DB_USER=sa
DB_PASSWORD=YourStrong!Pass123
JWT_ACCESS_SECRET=<long random string>
JWT_REFRESH_SECRET=<another long random string>
```

### 3.3 Migrate, seed, load demo data

```bash
npm run db:migrate     # 0001 identity · 0002 core domain · 0003 occupancy
npm run db:seed        # roles + permissions (seeds 0001–0004)
# demo portfolio + demo accounts:
docker exec -i 3martna-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
  -P 'YourStrong!Pass123' -C -d Amartna < ../demo/0001_demo_data.sql
```

Schema sanity check (no database needed — static verification):

```bash
node ../scripts/verify-schema.mjs
```

### 3.4 Start the backend

```bash
npm run dev            # http://localhost:4000, Swagger at /api/docs
```

---

## 4. Run the mobile app

```bash
cd mobile
# Point the app at your backend. On a phone, use your machine's LAN IP:
export EXPO_PUBLIC_API_URL=http://<your-machine-ip>:4000
npm run start          # scan the QR code with Expo Go
```

Notes
- iOS simulator / Android emulator can use `http://localhost:4000` /
  `http://10.0.2.2:4000` respectively.
- The app auto-logs-in on relaunch (secure token storage + transparent
  refresh-token rotation).

---

## 5. Demo credentials

| Email                     | Password   | Role            |
| ------------------------- | ---------- | --------------- |
| `manager@demo.3martna.jo` | `Demo123!` | BuildingManager |
| `admin@demo.3martna.jo`   | `Demo123!` | SuperAdmin      |

---

## 6. Demo workflow (the pilot script)

Sign in as the manager, then walk the pilot loop:

1. **Login** → lands on Home; open **Dashboard**. Out of the box it shows
   2 buildings, 5 apartments, 1 occupied (20%), 4 residents, 2 active
   leases and **one lease expiring in 12 days** (alert card).
2. **Create Building** — quick action `+ Building` (e.g. "Zahran Tower").
3. **Create Floor** — open the building → *Add floor* (e.g. floor 1).
4. **Create Apartment** — quick action `+ Apartment`, pick the new
   building/floor, unit "Z-101".
5. **Create Owner** — Owners → `+ Add Owner`, then edit the apartment and
   assign the owner (a lease needs a lessor on record).
6. **Register Resident** — quick action `+ Resident`.
7. **Create Lease** — quick action `+ Lease`: pick the apartment and the
   resident, set dates and rent. The lease is active immediately.
8. **Move Resident In** — quick action `Move In` (or from the lease):
   pick the lease, confirm the date. The apartment flips to *Leased*.
9. **Dashboard updates automatically** — pull to refresh: +1 building,
   +1 apartment, occupied +1, occupancy rate up, move-in tops the
   activity feed.
10. **Move Resident Out** — from the lease or Occupancy → Move-Out
    wizard; add a reason. The apartment returns to *Available*.
11. **Dashboard updates again** — occupied back down; the stay remains in
    **Occupancy History** (history is never deleted).

Every POST from the app carries an `Idempotency-Key`, so double-taps and
retries can never create duplicate data.

---

## 7. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Database is not configured (DB_HOST is empty)` on login | You're not in DEMO mode and `.env` has no `DB_HOST` — follow §3, or run with `DEMO_MODE=true`. |
| Mobile shows "Network error" | `EXPO_PUBLIC_API_URL` must be reachable **from the phone** — use the LAN IP, same Wi-Fi, firewall open on :4000. |
| 401 right after login | Access tokens live 15 min; the app refreshes automatically — a hard 401 loop means the backend restarted in DEMO mode (tokens are in-memory; sign in again). |
| Login says account locked | 5 failed attempts lock the account for 15 min (brute-force guard). |
| Demo data missing on SQL Server | Re-run `demo/0001_demo_data.sql` — it's idempotent and prints what it did. |
