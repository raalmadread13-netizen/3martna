#!/usr/bin/env bash
# Quality gate: typecheck + lint + format check + tests for every workspace.
# Used locally before every commit and by CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

run() {
  local name="$1"; shift
  echo "── $name"
  if "$@"; then echo "   ✓ pass"; else echo "   ✗ FAIL"; FAILED=1; fi
}

echo "═══ backend ═══"
cd "$ROOT/backend"
run "typecheck" npx tsc --noEmit
run "lint" npx eslint src tests
run "format" npx prettier --check "src/**/*.ts" "tests/**/*.ts"
run "tests" npx jest --runInBand

echo ""
echo "═══ mobile ═══"
cd "$ROOT/mobile"
run "typecheck" npx tsc --noEmit
run "lint" npx eslint App.tsx src
run "format" npx prettier --check "App.tsx" "src/**/*.{ts,tsx}"

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "✅ All checks passed."
else
  echo "❌ Some checks failed."
  exit 1
fi
