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
mkdir -p "$repo/web/src/shared/api/generated"
printf 'export const dashboard = 1\n' >"$repo/web/src/shared/api/generated/sdk.gen.ts"
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

# The dashboard compiles against a client of its own, and it drifts too.
dashboard="printf 'export const dashboard = 2\n' > web/src/shared/api/generated/sdk.gen.ts"
[ "$(run_with "$dashboard")" = 1 ] ||
  fail "the dashboard's generated client differing from the committed one must fail"
grep -q 'web/src/shared/api/generated/sdk.gen.ts' "$work/run.log" ||
  fail "the failure must name the dashboard's file that drifted"
grep -q 'codegen:web' "$work/run.log" || fail 'the failure must say how to regenerate the dashboard client'
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

# The generators the check runs by default have to export the spec from the
# API themselves. pnpm runs no pre-scripts, so a `precodegen` export never
# ran: both clients were regenerated from the committed spec, and the check
# could not see an API change at all, only a hand edit to a generated file.
node - "$root" <<'NODE' || fail 'codegen and codegen:web must export the spec themselves, not in a pre-script pnpm never runs'
const [root] = process.argv.slice(2)
const scripts = require(`${root}/packages/api-client/package.json`).scripts ?? {}
const silent = ['codegen', 'codegen:web'].filter(
  (name) => !(scripts[name] ?? '').includes('export-openapi'),
)

if (silent.length > 0) {
  console.error(`${silent.join(', ')} never export the spec`)
  process.exit(1)
}
NODE

echo 'api-client-drift.sh fails on drift and passes without it.'
