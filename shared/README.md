# shared/

Cross-application contracts — the single source of truth for shapes that
both the backend and the mobile app must agree on.

```
shared/
└── types/
    └── api.ts   # Response envelopes & pagination contracts
```

## Usage policy (Sprint 1)

Each app currently keeps its own copy of these types
(`backend/src/shared/types`, mobile mirrors on demand) with **this folder as
the canonical definition** — any change starts here and is mirrored in the
apps in the same pull request.

A later sprint can promote this folder to a published workspace package
(`@3martna/shared`) once the release pipeline is in place; the folder layout
is already package-shaped for that migration.
