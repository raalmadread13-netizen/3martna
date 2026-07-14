# Domain Layer

The innermost layer. Contains **entities** and **repository contracts** only.

Rules:

- Depends on nothing except `@shared` (pure types).
- No Express, no SQL, no Firebase, no HTTP — ever.
- Business entities (User, Building, Apartment, Contract, ...) are added
  here in feature sprints, together with their repository interfaces in
  `repositories/`.
