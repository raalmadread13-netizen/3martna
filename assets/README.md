# assets/

Brand assets shared across the product (mobile app, future web dashboard,
marketing).

Expected contents (added by the design sprint):

```
assets/
├── logo/          # SVG + PNG logo, light & dark variants
├── app-icons/     # 1024×1024 source icon, adaptive icon foreground
└── splash/        # Splash source artwork
```

Brand direction: **luxury navy (#0F172A) & gold (#C8A24B)** — see
`mobile/src/presentation/theme/colors.ts` for the canonical palette.

The mobile app currently uses Expo's default icon/splash; once real assets
land here, copy the exports into `mobile/assets/` and reference them from
`mobile/app.json`.
