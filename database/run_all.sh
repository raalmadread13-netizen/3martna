#!/usr/bin/env bash
# Run all 3martna database scripts in order.
# Usage: ./run_all.sh <server> <user> <password>
set -euo pipefail

SERVER="${1:-localhost}"
USER="${2:-sa}"
PASSWORD="${3:?Usage: ./run_all.sh <server> <user> <password>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts"

for script in "$SCRIPT_DIR"/[0-9]*.sql; do
  name="$(basename "$script")"
  # 10_backup.sql is operational, not part of provisioning
  if [[ "$name" == 10_* ]]; then
    echo "-- Skipping $name (run manually for backups)"
    continue
  fi
  echo "== Running $name =="
  sqlcmd -S "$SERVER" -U "$USER" -P "$PASSWORD" -b -i "$script"
done

echo "✅ Database provisioned successfully."
