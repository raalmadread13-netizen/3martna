#!/usr/bin/env bash
# One-shot developer setup: env files + dependencies for every workspace.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "── 3martna setup ──────────────────────────────"

for app in backend mobile; do
  if [[ ! -f "$ROOT/$app/.env" ]]; then
    cp "$ROOT/$app/.env.example" "$ROOT/$app/.env"
    echo "✓ created $app/.env (edit it with real values)"
  fi
  echo "→ installing $app dependencies..."
  (cd "$ROOT/$app" && npm install --no-audit --no-fund)
done

echo ""
echo "✅ Setup complete."
echo "   backend:  cd backend && npm run dev     → http://localhost:4000/health"
echo "   mobile:   cd mobile && npx expo start"
