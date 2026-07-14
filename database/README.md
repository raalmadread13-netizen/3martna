# Database — Microsoft SQL Server

Sprint 1 ships the **structure only**: connection layer (in
`backend/src/infrastructure/database/`), a forward-only migration runner,
and a seed runner. **No business tables exist yet** — they arrive with
feature sprints as numbered migrations.

## Layout

```
database/
├── migrations/   # Versioned schema changes: NNNN_description.sql
└── seeds/        # Idempotent reference/demo data: NNNN_description.sql
```

## Conventions

- **Naming**: `0001_create_users.sql`, `0002_create_buildings.sql`, ...
  Four-digit prefix defines execution order. Files are immutable once merged —
  never edit an applied migration, add a new one.
- **Batches**: standard T-SQL `GO` separators are supported.
- **Tracking**: applied migrations are recorded in `dbo._MigrationsHistory`
  (created automatically by the runner).
- **Transactions**: each migration runs inside its own transaction and is
  rolled back completely on failure.
- **Seeds** must be idempotent — always guard with `IF NOT EXISTS`.

## Usage

```bash
# from backend/ (uses the same .env database settings)
npm run db:migrate
npm run db:seed
```

## Local SQL Server (Docker)

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" \
  -p 1433:1433 --name martna-sql -d mcr.microsoft.com/mssql/server:2022-latest

# create the database once
docker exec -it martna-sql /opt/mssql-tools/bin/sqlcmd -U sa -P 'YourStrong!Passw0rd' \
  -Q "IF DB_ID('Amartna') IS NULL CREATE DATABASE Amartna;"
```
