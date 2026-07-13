# 3martna — SQL Server Database

Microsoft SQL Server database for عمارتنا (3martna). Fully normalized (3NF), with
foreign keys, check constraints, indexes, views, triggers, and stored procedures
for every application operation.

## Requirements

- Microsoft SQL Server 2019+ (or Azure SQL Database)
- `sqlcmd` or SQL Server Management Studio (SSMS)

## Running the Scripts (in order)

```bash
sqlcmd -S localhost -U sa -P <password> -i scripts/00_create_database.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/01_tables.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/02_indexes.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/03_views.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/04_triggers.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/05_procs_auth_users.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/06_procs_property.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/07_procs_finance.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/08_procs_operations.sql
sqlcmd -S localhost -U sa -P <password> -i scripts/09_seed_data.sql
```

Or run everything at once:

```bash
./run_all.sh localhost sa <password>
```

## Contents

| Script | Purpose |
|---|---|
| `00_create_database.sql` | Creates the `Amartna` database |
| `01_tables.sql` | 38 tables, PKs, FKs, CHECK constraints, defaults |
| `02_indexes.sql` | Non-clustered & filtered indexes for hot query paths |
| `03_views.sql` | Reporting & read-model views |
| `04_triggers.sql` | Audit triggers, invoice status recalc, apartment status sync |
| `05_procs_auth_users.sql` | Auth, users, roles, refresh tokens, devices, settings |
| `06_procs_property.sql` | Buildings, floors, apartments, parking, storage, residents, contracts |
| `07_procs_finance.sql` | Invoices, payments, receipts, expenses, reports, dashboards |
| `08_procs_operations.sql` | Maintenance, complaints, visitors, security, announcements, notifications, documents, chat, audit |
| `09_seed_data.sql` | Roles, lookup data, demo data for development |
| `10_backup.sql` | Full/differential backup & restore scripts |

## Conventions

- **Primary keys**: `INT IDENTITY(1,1)` (BIGINT for high-volume logs).
- **Timestamps**: `DATETIME2(0)` in UTC, default `SYSUTCDATETIME()`.
- **Soft delete**: `IsDeleted BIT` + `DeletedAt` on user-facing entities.
- **Enums**: `VARCHAR` columns with `CHECK` constraints (documented in DATABASE.md).
- **Money**: `DECIMAL(12,2)` — Jordanian Dinar (JOD).
- **Stored procedures**: named `sp_<Entity>_<Action>`; all app queries go through SPs.
- **Pagination**: list SPs accept `@Page`, `@PageSize` and return `TotalCount`.

ER diagram: [docs/ER_DIAGRAM.md](../docs/ER_DIAGRAM.md)
