# Folder Structure

```
3martna/
├── README.md                  # Project overview & quick start
├── .editorconfig              # Editor consistency (spaces, LF, UTF-8)
├── .gitignore
│
├── backend/                   # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── domain/            #   Entities & repository contracts (innermost)
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   ├── application/       #   Use-cases & service interfaces
│   │   │   ├── use-cases/
│   │   │   └── interfaces/
│   │   ├── infrastructure/    #   Implementations of the contracts
│   │   │   ├── database/      #     SQL Server pool, execProc, migrate, seed
│   │   │   ├── firebase/      #     Firebase Admin (auth/storage/push/rtdb)
│   │   │   ├── logging/       #     winston logger (ILogger impl)
│   │   │   └── security/      #     bcrypt hasher, JWT token service
│   │   ├── presentation/
│   │   │   └── http/          #   Express: app, server, routes, controllers,
│   │   │       │              #   middleware, swagger
│   │   │       ├── controllers/
│   │   │       ├── middleware/
│   │   │       └── routes/
│   │   └── shared/            #   env config, AppError, API types
│   ├── tests/                 # Jest + supertest
│   ├── .env.example           # Environment template (no secrets)
│   ├── .eslintrc.cjs / .prettierrc
│   └── tsconfig.json          # strict + path aliases (@domain, @shared, ...)
│
├── mobile/                    # React Native (Expo) + TypeScript
│   ├── App.tsx                # ThemeProvider + RootNavigator
│   ├── src/
│   │   ├── presentation/
│   │   │   ├── screens/       #   Splash, Welcome, Login, Register, Home, Settings
│   │   │   ├── navigation/    #   Typed native stack
│   │   │   ├── components/ui/ #   Screen, AppButton, AppTextInput
│   │   │   └── theme/         #   Palette + light/dark ThemeProvider
│   │   ├── application/hooks/ #   useAppBootstrap
│   │   ├── domain/            #   (reserved for entities)
│   │   ├── infrastructure/
│   │   │   ├── api/           #   axios client + token interceptor
│   │   │   ├── firebase/      #   Firebase JS SDK init (prepared)
│   │   │   ├── notifications/ #   expo-notifications plumbing (prepared)
│   │   │   └── storage/       #   SecureStore wrapper
│   │   └── shared/            #   env, constants, utils
│   ├── .env.example
│   ├── app.json / eas-ready config
│   └── tsconfig.json          # strict + @/* alias
│
├── database/                  # SQL Server
│   ├── migrations/            # NNNN_*.sql — forward-only, transactional
│   ├── seeds/                 # NNNN_*.sql — idempotent
│   └── README.md              # Conventions + local Docker instructions
│
├── shared/                    # Cross-app canonical contracts
│   └── types/api.ts           # Response envelopes, pagination
│
├── docs/                      # This documentation set
├── scripts/                   # setup.sh (bootstrap), check.sh (quality gate)
├── assets/                    # Brand assets (design sprint)
└── config/                    # Configuration strategy & Firebase placement
```

## Why this shape

- **Apps are self-contained** — each has its own package.json, tooling, and
  can be extracted to its own repository later without surgery.
- **Layers are folders** — the dependency rule is visible in the import path;
  a `@presentation` import inside `domain/` fails review at a glance.
- **Database is code** — schema history lives in numbered migrations next to
  the app that consumes it, applied by `npm run db:migrate`.
