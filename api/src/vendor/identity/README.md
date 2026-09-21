# @work-address/identity (vendored)

A byte-for-byte copy of `contracts/packages/identity/src` in this repository
(MIT), taken when the library lived in its own `contracts` repository at
commit `ccf8c963b8a0bcf0813cec0f2324dec31a861bde` (the library itself last
changed in `198c4d0`). It builds and checks profile schema v1 commitments for
`IdentityRegistry`: salted 32-leaf Merkle trees, the registry commitment,
proofs, private exports, presentations and self-signed mode. Pure
computation, no network calls. See `contracts/packages/identity/README.md`
for the full API.

**Do not edit these files here.** A change belongs in
`contracts/packages/identity`, where the library is tested against the
deployed registry; then copy `contracts/packages/identity/src/*.ts` over this
directory and `contracts/packages/identity/test/fixtures/profile-schema-v1.vectors.json`
over `api/src/test/fixture/profile-schema-v1.vectors.json`, and update the
commit above. `api/src/test/service/identity-library.test.ts` reproduces every
vector in that fixture with this copy, so a drifted or hand-edited copy fails
the suite instead of computing a different commitment than the chain.

## Why a copy rather than a dependency

- The package ships TypeScript and builds to `dist/` only on demand, while
  the API runs compiled JavaScript from `api/build`. Here the files are
  compiled with the API itself, so production needs no second build step.
- The copy is pinned twice: to a commit, and to the published vectors, which
  `contracts/` also checks against `IdentityRegistry` on chain.

The library used to sit in a separate repository outside the API's Docker
build context, which was the first reason for the copy. Since contracts moved
into this monorepo that reason is gone, and the library could become a
`workspace:*` dependency once the API builds it ahead of itself.

Lint does not run over this directory (it keeps the library's own
formatting, so a diff against the source stays empty); the API's typecheck
and tests do.
