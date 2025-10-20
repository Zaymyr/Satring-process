#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/push-supabase-migrations.sh [additional supabase args]

Environment variables:
  SUPABASE_PROJECT_REF  Required. The project ref shown in the Supabase dashboard (e.g. abcd1234efgh5678).
  SUPABASE_BIN          Optional. Override path to the supabase CLI binary (defaults to `supabase` on PATH).

The script verifies that the Supabase CLI is available, ensures a project ref is set,
then runs `supabase db push --project-ref "$SUPABASE_PROJECT_REF"` with any extra arguments passed through.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "error: SUPABASE_PROJECT_REF is not set" >&2
  usage >&2
  exit 1
fi

SUPABASE_CLI=${SUPABASE_BIN:-supabase}

if ! command -v "$SUPABASE_CLI" >/dev/null 2>&1; then
  echo "error: Supabase CLI not found. Install it or point SUPABASE_BIN to the binary." >&2
  exit 1
fi

set -x
"$SUPABASE_CLI" db push --project-ref "$SUPABASE_PROJECT_REF" "$@"
