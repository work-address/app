# Vendored code

Verbatim copies of other repositories' code, kept in their own formatting so a
diff against the source stays empty. Lint does not run over `identity/`
(`eslint.config.js`); the app's typecheck and tests do.

**Do not edit these files here.**

## `identity/`

`@work-address/identity`, the same copy the API holds in
`api/src/vendor/identity`, which is itself a byte-for-byte copy of
`packages/identity/src` from the open `contracts` repository (MIT). It builds
profile schema v1 commitments for `IdentityRegistry`: salted 32-leaf Merkle
trees, the registry commitment, proofs, private exports and presentations.
Pure computation, no network calls, browser-safe.

The browser needs it because the holder builds their own tree here: the salts
and the private export never leave the device unless the holder sends them,
and the commitment the wallet publishes has to be the one the API and the
registry will recompute. A second implementation would eventually compute a
different commitment than the chain, so there is one implementation, copied.

### What differs from the API's copy, and why

`verify-document.ts` is **not** copied, and `index.ts` therefore drops its one
`export * from './verify-document'` line. Nothing else differs.

Verification is the API's job: the browser builds and presents documents, and
`PUT /user/identity` checks every one of them against this same library and
against the registry before hosting it. The file is also the only one in the
library that uses a TypeScript parameter property, which `erasableSyntaxOnly`
in `tsconfig.app.json` forbids — so copying it would mean editing it, and an
edited copy is the thing this arrangement exists to prevent.

`identity-vendor.test.ts` pins both halves of that: every other file must be
byte-identical to `api/src/vendor/identity`, and `index.ts` must be the API's
`index.ts` with exactly that one line removed. The API's copy is in turn
pinned to the published schema v1 vectors by
`api/src/test/service/identity-library.test.ts`, so a drifted copy here fails
a test rather than computing a different commitment than the chain.

### Updating it

Update `api/src/vendor/identity` first, following the instructions in its own
README, then copy `api/src/vendor/identity/*.ts` over `identity/`, delete
`identity/verify-document.ts` and remove its export line from `identity/index.ts`.
