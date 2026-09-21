#!/usr/bin/env bash
#
# Fails when the committed API client is not what the API generates (WP-128).
#
# packages/api-client is generated from the API's own OpenAPI spec and then
# committed: the dashboard, the desktop tracker and the API's own tests
# compile against the committed copy, not against the API. A route, a field
# or an enum value changed in api/ without `pnpm codegen:api-client` leaves
# them calling an API that no longer exists, and nothing fails until a
# browser does. This regenerates the client and
# refuses any difference, so the pull request that changes the API is the one
# that has to carry the regenerated client.
#
#   scripts/api-client-drift.sh
#
# The export is deterministic - two runs over the same API write the same
# bytes - which is what makes a diff mean drift and nothing else.
#
# API_CLIENT_CODEGEN replaces the regeneration command, and API_CLIENT_REPO
# the repository it runs in; scripts/api-client-drift.test.sh uses both to
# prove this script fails when it should without running the real generator.
#
set -euo pipefail

repo="${API_CLIENT_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
codegen="${API_CLIENT_CODEGEN:-pnpm codegen:api-client}"
client='packages/api-client'

cd "$repo"

# A client already edited or half-regenerated would make the verdict below
# mean nothing: it has to start from what is committed.
if [ -n "$(git status --porcelain -- "$client")" ]; then
  echo "$client already differs from HEAD; commit or discard that first:" >&2
  git status --short -- "$client" >&2
  exit 2
fi

echo "Regenerating the API client: $codegen"
bash -c "$codegen"

# `git status`, not `git diff`: a file the generator newly writes is
# untracked, and a plain diff would never see it.
drift="$(git status --porcelain -- "$client")"

if [ -n "$drift" ]; then
  echo >&2
  echo "The committed API client is out of step with the API:" >&2
  echo "$drift" >&2
  echo >&2
  git --no-pager diff --stat -- "$client" >&2
  echo >&2
  echo "Run \`pnpm codegen:api-client\` and commit the result with the API change." >&2
  exit 1
fi

echo "The committed API client is what the API generates."
