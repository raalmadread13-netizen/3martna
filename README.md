# عمارتنا — 3martna

**A complete, production-ready apartment & building management platform for Jordan.**

منصّة متكاملة لإدارة العمارات والشقق السكنية — جاهزة للإطلاق الفوري في الأردن.

---

## 🏢 What is 3martna?

3martna (عمارتنا, "Our Building") is a full-stack property management platform connecting **building owners, apartment owners, tenants, maintenance staff, security guards, cleaning staff, and accountants** in one system:

- 📱 **Mobile App** — React Native (Expo), Arabic RTL + English, dark/light themes
- 🖥️ **Admin Dashboard** — React + Vite web app for system administrators
- ⚙️ **REST API** — Node.js + Express + TypeScript with JWT auth & RBAC
- 🗄️ **Database** — Microsoft SQL Server with stored procedures, views, triggers
- 🔥 **Firebase** — push notifications, OTP, file storage, realtime chat, analytics

## 📦 Monorepo Structure

```
3martna/
├── backend/     # Node.js + Express + TypeScript REST API
├── mobile/      # React Native (Expo) mobile app — AR/EN, RTL, dark mode
├── admin/       # React + Vite admin dashboard (deployed to Vercel)
├── database/    # SQL Server schema, stored procedures, views, triggers, seed
├── docs/        # Architecture, API, database, deployment documentation
└── .github/     # CI/CD workflows
```

## ✨ Core Features

| Domain | Highlights |
|---|---|
| **Authentication** | JWT + refresh tokens, Firebase OTP, biometric login, password reset |
| **Buildings & Apartments** | Buildings, floors, apartments, parking, storage, utility meters |
| **Residents** | Owners, tenants, move-in/out, history, emergency contacts, documents |
| **Rent & Finance** | Contracts, automatic invoices, late fees, payments, PDF receipts, expenses |
| **Maintenance** | Requests, technician assignment, priorities, before/after photos, GPS check-in |
| **Complaints** | Anonymous option, tracking, comments, attachments, resolution history |
| **Visitors** | QR codes, approvals, guard scanning, check-in/out, gate logs |
| **Security** | Incident reports, gate logs, emergency alerts |
| **Chat** | Firebase realtime private & group chat, typing indicators, read receipts |
| **Reports** | Financial, occupancy, maintenance — charts, PDF & Excel export |
| **Notifications** | Push (FCM), in-app, realtime alerts |

## 🚀 Quick Start

```bash
# 1. Database — run scripts in order against SQL Server
cd database && ls scripts/        # 00 → 08, see database/README.md

# 2. Backend API
cd backend && cp .env.example .env && npm install && npm run dev

# 3. Admin dashboard
cd admin && cp .env.example .env && npm install && npm run dev

# 4. Mobile app
cd mobile && cp .env.example .env && npm install && npx expo start
```

Full guides: [docs/INSTALLATION.md](docs/INSTALLATION.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, diagrams, decisions
- [Database](docs/DATABASE.md) — tables, ER diagram, stored procedures
- [API Reference](docs/API.md) — REST endpoints (+ live Swagger at `/api/docs`)
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md)
- [Folder Structure](docs/FOLDER_STRUCTURE.md)
- [Testing](docs/TESTING.md) — unit, integration, manual test cases
- [Security](docs/SECURITY.md) — threat model & mitigations

## 🔐 Security

SQL injection protection (parameterized stored procedures), XSS sanitization, rate
limiting, helmet secure headers, bcrypt password hashing, JWT with rotating refresh
tokens, role-based authorization, full audit logging. Details in
[docs/SECURITY.md](docs/SECURITY.md).

## 🌍 Localization

Arabic (RTL) and English with instant in-app switching — no restart required.

## 📄 License

Proprietary — © 2026 3martna. All rights reserved.
