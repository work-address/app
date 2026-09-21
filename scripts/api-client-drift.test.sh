#!/usr/bin/env bash
#
# scripts/api-client-drift.sh has to FAIL on drift - a check that cannot fail
# is worse than none - so this runs it against a throwaway repository with a
# stand-in generator: one that writes what is committed, one that changes a
# generated file, one that writes a file nobody committed, and one run over
# a client that was already dirty.
#
#   scripts/api-client-drift.test.sh
#
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"

trap 'rm -rf "$work"' EXIT

fail() {
  echo "FAIL: $1" >&2
  echo "--- the script's output ---" >&2
  cat "$work/run.log" >&2 2>/dev/null || true
  exit 1
}

repo="$work/repo"
mkdir -p "$repo/packages/api-client/src"
printf '{"openapi":"3.0.0"}\n' >"$repo/packages/api-client/openapi.json"
printf 'export const generated = 1\n' >"$repo/packages/api-client/src/sdk.gen.ts"
git -C "$repo" init -q
git -C "$repo" -c user.name=test -c user.email=test@example.invalid add -A
git -C "$repo" -c user.name=test -c user.email=test@example.invalid \
  commit -q -m 'a committed client'

# Runs the script with `codegen` as the generator; echoes its exit status.
run_with() {
  local status=0

  API_CLIENT_REPO="$repo" API_CLIENT_CODEGEN="$1" \
    "$root/scripts/api-client-drift.sh" >"$work/run.log" 2>&1 || status=$?

  echo "$status"
}

reset_repo() {
  git -C "$repo" checkout -q -- .
  git -C "$repo" clean -fdq
}

same="printf 'export const generated = 1\n' > packages/api-client/src/sdk.gen.ts"
[ "$(run_with "$same")" = 0 ] ||
  fail 'a generator that writes what is committed must pass'

changed="printf 'export const generated = 2\n' > packages/api-client/src/sdk.gen.ts"
[ "$(run_with "$changed")" = 1 ] ||
  fail 'a generated file that differs from the committed one must fail'
grep -q 'sdk.gen.ts' "$work/run.log" || fail 'the failure must name the file that drifted'
grep -q 'codegen:api-client' "$work/run.log" || fail 'the failure must say how to fix it'
reset_repo

added="printf 'export {}\n' > packages/api-client/src/new-route.gen.ts"
[ "$(run_with "$added")" = 1 ] ||
  fail 'a generated file nobody committed must fail (git diff alone misses it)'
grep -q 'new-route.gen.ts' "$work/run.log" || fail 'the failure must name the new file'
reset_repo

printf '{"openapi":"3.1.0"}\n' >"$repo/packages/api-client/openapi.json"
[ "$(run_with "$same")" = 2 ] ||
  fail 'a client that was already dirty must be refused, not judged'
reset_repo

# Anything outside the client is somebody else's business.
elsewhere="printf 'x\n' > unrelated.txt"
[ "$(run_with "$elsewhere")" = 0 ] ||
  fail 'a change outside packages/api-client is not client drift'

echo 'api-client-drift.sh fails on drift and passes without it.'
