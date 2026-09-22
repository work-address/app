#!/usr/bin/env bash
#
# Fails when a committed API client is not what the API generates (WP-128).
#
# Two clients are generated from the API's own OpenAPI spec and committed:
# packages/api-client, which the API's own tests and scripts call, and
# web/src/shared/api/generated, which the dashboard compiles against. Neither
# is built from the API at compile time. A route, a field or an enum value
# changed in api/ without regenerating them leaves their callers on an API
# that no longer exists, and nothing fails until a browser does. This
# regenerates both and refuses any difference, so the pull request that
# changes the API is the one that has to carry the regenerated clients.
#
#   scripts/api-client-drift.sh
#
# The export is deterministic - two runs over the same API write the same
# bytes - which is what makes a diff mean drift and nothing else. Each
# codegen script exports the spec itself: pnpm runs no pre-scripts, and a
# client regenerated from the committed spec could never show drift.
#
# API_CLIENT_CODEGEN replaces the regeneration command, API_CLIENT_PATHS the
# space-separated generated paths it is held to, and API_CLIENT_REPO the
# repository it runs in; scripts/api-client-drift.test.sh uses them to prove
# this script fails when it should without running the real generator.
#
set -euo pipefail

repo="${API_CLIENT_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
codegen="${API_CLIENT_CODEGEN:-pnpm codegen:api-client && pnpm --filter @app/api-client codegen:web}"
read -ra clients <<<"${API_CLIENT_PATHS:-packages/api-client web/src/shared/api/generated}"

cd "$repo"

# A client already edited or half-regenerated would make the verdict below
# mean nothing: it has to start from what is committed.
if [ -n "$(git status --porcelain -- "${clients[@]}")" ]; then
  echo "${clients[*]} already differs from HEAD; commit or discard that first:" >&2
  git status --short -- "${clients[@]}" >&2
  exit 2
fi

echo "Regenerating the API client: $codegen"
bash -c "$codegen"

# `git status`, not `git diff`: a file the generator newly writes is
# untracked, and a plain diff would never see it.
drift="$(git status --porcelain -- "${clients[@]}")"

if [ -n "$drift" ]; then
  echo >&2
  echo "A committed API client is out of step with the API:" >&2
  echo "$drift" >&2
  echo >&2
  git --no-pager diff --stat -- "${clients[@]}" >&2
  echo >&2
  echo "Run \`pnpm codegen:api-client\` and \`pnpm --filter @app/api-client codegen:web\`, and commit the result with the API change." >&2
  exit 1
fi

echo "The committed API clients are what the API generates."
