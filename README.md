# عمارتنا — 3martna

**Apartment & building management platform for Jordan.**

منصّة إدارة العمارات والشقق السكنية — الأردن.

> **Status: Sprint 2 — Authentication & Identity ✅**
> Sprint 1 delivered the Clean Architecture foundation; Sprint 2 adds a
> complete production-grade identity system: SQL Server-backed users, roles
> and database-driven permissions, JWT auth with rotating refresh tokens,
> brute-force protection, email/phone verification, and the full mobile auth
> flow (auto-login, auto-refresh, secure storage). Business features
> (buildings, rent, maintenance) arrive in the next sprints.
>
> **CTO decision:** SQL Server is the only source of truth for identity.
> Firebase is used solely for push notifications, storage and future
> messaging — never for user management.

## Monorepo Layout

```
3martna/
├── mobile/      # React Native (Expo) + TypeScript — Clean Architecture
├── backend/     # Node.js + Express + TypeScript — Clean Architecture
├── database/    # SQL Server migration & seed structure
├── shared/      # Types & constants shared across apps
├── docs/        # Architecture, installation, environment docs
├── scripts/     # Developer & CI helper scripts
├── assets/      # Brand assets (logo, icons)
└── config/      # Configuration strategy & Firebase placement guide
```

Folder-by-folder details: [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo), TypeScript, React Navigation |
| Backend | Node.js, Express.js, TypeScript |
| Database | Microsoft SQL Server |
| Cloud | Firebase (Auth, Storage, Push, Realtime DB) |
| Quality | ESLint, Prettier, strict TypeScript, path aliases |

## Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npm run dev          # → http://localhost:4000/health

# 2. Mobile
cd mobile
cp .env.example .env
npm install
npx expo start
```

Full guide: [docs/INSTALLATION.md](docs/INSTALLATION.md)

## Architecture

Both apps follow **Clean Architecture** with strict layer boundaries:

```
Presentation → Application → Domain ← Infrastructure
                    ↘        Shared        ↙
```

- **Domain** — entities and repository contracts. Depends on nothing.
- **Application** — use-cases and service interfaces. Depends on Domain only.
- **Infrastructure** — SQL Server, Firebase, JWT, bcrypt, logging. Implements
  Application/Domain contracts.
- **Presentation** — Express HTTP layer / React Native screens. Calls
  use-cases, never touches infrastructure directly.
- **Shared** — configuration, errors, pure utilities.

Details and rationale: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Verification

```bash
./scripts/check.sh   # typecheck + lint + tests for every workspace
```

## Security Baseline (Sprint 1)

Helmet secure headers, CORS allowlist, rate limiting, centralized error
handling, bcrypt password-hashing utilities, JWT utilities, validated
environment configuration — and no hardcoded secrets anywhere.

## License

Proprietary — © 2026 3martna. All rights reserved.
