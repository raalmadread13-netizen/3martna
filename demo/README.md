# 3martna — Demo Assets

Everything needed to demo the MVP with realistic data. Full instructions
live in [`docs/DEMO.md`](../docs/DEMO.md).

## Demo accounts

| Email                     | Password   | Role            |
| ------------------------- | ---------- | --------------- |
| `manager@demo.3martna.jo` | `Demo123!` | BuildingManager |
| `admin@demo.3martna.jo`   | `Demo123!` | SuperAdmin      |

Both accounts belong to the demo tenant **Demo Property Management**.

## Two ways to get demo data

1. **DEMO mode (zero setup, no SQL Server)** — start the backend with
   `DEMO_MODE=true npm run dev`. The API runs on in-memory repositories and
   seeds the portfolio below automatically at boot
   (`backend/src/infrastructure/memory/demo.ts`). Data resets on restart.

2. **SQL Server** — after `npm run db:migrate` and `npm run db:seed`, run
   [`0001_demo_data.sql`](./0001_demo_data.sql) against the database
   (idempotent; safe to re-run).

## The demo portfolio

| Asset | Contents |
| ----- | -------- |
| Buildings | **Amman Heights** (Jabal Amman, 2 floors seeded) · **Petra Residence** (Sweifieh) |
| Apartments | 101 (occupied), 102, 103, 201, 202 |
| Owners | Layla Haddad (individual) · ACME Real Estate (company) |
| Residents | Sara Khalil (living in 101) · Omar Nassar (lease signed, not moved in) · Rania Aloul (registered) · Bilal Odeh (moved out — history) |
| Leases | `LC-DEMO-000101` active (Sara) · `LC-DEMO-000102` active, **expires in 12 days** (Omar — feeds the dashboard alert) · `LC-DEMO-000201` terminated (Bilal) |
| Occupancy | 1 current stay (Sara) · 1 closed stay (Bilal — history) |

The dates are relative to seed time, so the dashboard always shows one
expiring-lease alert and a 20% occupancy rate out of the box.
