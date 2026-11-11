#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/docker/.env" ]]; then
  echo "Create docker/.env from docker/.env.example first." >&2
  exit 1
fi

set -a
source "$repo_root/docker/.env"
set +a

export PGHOST=127.0.0.1
export PGPORT="${AGE_PORT:-5432}"
export PGUSER=graphlab
export PGDATABASE=graphlab
export PGPASSWORD="$AGE_PASSWORD"

cd "$repo_root"
exec npx concurrently -k -n api,web -c blue,green \
  "npm run dev -w @graph-lab/api" \
  "npm run dev -w @graph-lab/web"
