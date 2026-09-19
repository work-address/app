# @work-address/identity (vendored)

A byte-for-byte copy of `packages/identity/src` from the open `contracts`
repository (MIT), at commit `ccf8c963b8a0bcf0813cec0f2324dec31a861bde`
(the library itself last changed in `198c4d0`). It builds and checks profile
schema v1 commitments for `IdentityRegistry`: salted 32-leaf Merkle trees,
the registry commitment, proofs, private exports, presentations and
self-signed mode. Pure computation, no network calls. See the library's own
README in the contracts repository for the full API.

**Do not edit these files here.** A change belongs in the contracts
repository, where the library is tested against the deployed registry; then
copy `packages/identity/src/*.ts` over this directory and
`test/fixtures/profile-schema-v1.vectors.json` over
`api/src/test/fixture/profile-schema-v1.vectors.json`, and update the commit
above. `api/src/test/service/identity-library.test.ts` reproduces every
vector in that fixture with this copy, so a drifted or hand-edited copy fails
the suite instead of computing a different commitment than the chain.

## Why a copy rather than a dependency

- `app` is its own repository and CI checks out only `app`, and the API's
  Docker build context is `app/`. A `file:../../contracts/packages/identity`
  dependency resolves on a machine with both checkouts side by side and
  nowhere else.
- The package ships TypeScript and builds to `dist/` only on demand, while
  the API runs compiled JavaScript from `api/build`. Here the files are
  compiled with the API itself, so production needs no second build step.
- The copy is pinned twice: to a commit, and to the published vectors, which
  the contracts repository also checks against `IdentityRegistry` on chain.

Lint does not run over this directory (it keeps the contracts repository's
formatting, so a diff against the source stays empty); the API's typecheck
and tests do.
