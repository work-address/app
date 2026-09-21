# @work-address/identity

Builds, presents and checks Work Address profile commitments under
[profile schema v1](../../docs/profile-schema-v1.md). It is the open library
side of `IdentityRegistry`: the contract stores a commitment it cannot open,
and this package is how a holder produces one and how anyone checks what the
holder later shows.

- **Pure computation.** No network calls, no RPC, no key custody. Randomness
  comes from Web Crypto `getRandomValues`. It runs in a browser and in Node 19
  or later. The one chain call a verifier needs, `checkPresentation`, is
  returned as arguments for the caller to make with whatever provider it
  trusts.
- **Built on ethers v6** for Keccak-256, ABI encoding, EIP-55 and EIP-191, and
  on `@noble/curves` (the copy ethers already ships) for Ed25519.
- **Byte-exact with the chain.** Leaves use the registry's
  `PROFILE_LEAF_TYPEHASH`; internal nodes are OpenZeppelin's
  `Hashes.commutativeKeccak256`; the commitment is the registry's
  `profileCommitment()`. The vectors in
  `test/fixtures/profile-schema-v1.vectors.json` come from an independent
  standard-library Python encoder, and this package reproduces every one of
  them byte for byte, documents and signatures included.
- **Not a standard.** Subjects are named with `did:pkh` as a convention. No
  DID method, resolver or DID Core conformance is claimed, and a presentation
  is not a Verifiable Credential: it is a person describing themselves.
- **Unaudited,** like the contracts it serves.

## What it does

| Step | Function | Output |
| --- | --- | --- |
| Read the app's public profile | `profileFieldsFromAppUser(user)` | schema v1 fields, and the columns that could not be committed |
| Build a tree | `buildProfileTree({ subject, fields })` | 32 leaves, a fresh CSPRNG salt per field and a filler per empty slot, the root |
| Anchor it | `profileCommitment({ chainId, registry, subject, schemaId, root })` | the `bytes32` to pass to `IdentityRegistry.publish` |
| Keep it | `createProfileExport(tree)`, `restoreProfileTree(export)` | the private export: every value, salt and filler |
| Show some fields | `createAnchoredPresentation(tree, { disclose, anchor })` | chosen fields, each with its salt and 5-element proof |
| Show without a chain | `selfSignedMessageFor(tree)`, `createSelfSignedPresentation(tree, { disclose, signature })` | the same, bound by the wallet's own signature |
| Check what was shown | `verifyPresentationDocument(document)` | the disclosed fields, or the reason it failed; for an anchored one, the `checkPresentation` arguments |
| Write a document | `serializeDocument(document)` | its RFC 8785 (JCS) text |

```ts
import {
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  evmSubject,
  profileFieldsFromAppUser,
  serializeDocument,
  verifyPresentationDocument,
} from '@work-address/identity'

const { fields, skipped } = profileFieldsFromAppUser(publicUser)
const tree = buildProfileTree({ subject: evmSubject(address, chainId), fields })

// The holder keeps this. It holds every value and salt: never upload it as it is.
const backup = serializeDocument(createProfileExport(tree))

// Publish presentation.commitment with IdentityRegistry.publish(commitment, 1, currentVersion).
const presentation = createAnchoredPresentation(tree, {
  disclose: ['name', 'skills', 'rate'],
  anchor: { chainId, registry, version: 1 },
})

const check = verifyPresentationDocument(serializeDocument(presentation))

if (check.ok && check.mode === 'anchored') {
  // Offline, the proofs and the commitment hold. Whether this is the current,
  // an old or a withdrawn version is the registry's answer:
  // registry.checkPresentation(subject, version, commitment, schemaId)
  const { subject, version, commitment, schemaId } = check.registryCheck
}
```

## Guarantees and limits

- **Every proof has 5 elements.** A tree always has 32 leaves; empty and
  reserved slots hold random fillers, so a tree does not reveal how many
  fields were filled in.
- **Tampering fails.** Changing any disclosed value, salt, slot, pointer or
  proof element, the subject, the schema id, the root, the commitment, the
  registry or the signature makes `verifyPresentationDocument` fail. A leaf
  binds the subject, so a presentation cannot be moved onto another wallet.
- **One byte string per value.** Building normalizes loose input (trim, NFC,
  empty list items dropped, decimal rate to whole cents). Verifying never
  normalizes: a value that is not already canonical is refused.
- **Salts are drawn per field and per build.** Building the same fields twice
  gives two different roots, which is what a new published version needs.
  Pass `randomBytes` only to reproduce test vectors.
- **Only the schema v1 fields.** Name, title, company, bio, hourly rate,
  skills, city, country and six social handles. Email, phone, roles, premium
  and the time zone have no slot and are never read from the app record.
- **Subjects.** `did:pkh:eip155` accounts can anchor on the registry's chain,
  and can self-sign with EIP-191 (EOAs only; ERC-1271 needs a chain call).
  `did:pkh:solana` accounts self-sign with Ed25519; the registry cannot hold
  them, so their leaves bind the low 20 bytes of `keccak256(did)`.
- **A self-signature proves authorship, not currency.** It cannot say whether
  a newer version exists or whether the profile was withdrawn. Only an
  anchored presentation plus `checkPresentation` can, and a verifier UI must
  show the difference.

## Develop

This package is a member of the repository's pnpm workspace; `pnpm install` at
the repository root installs it. From `contracts/`:

```bash
pnpm run test:identity        # mocha: vectors, tampering, trees, documents, no network
pnpm run typecheck:identity   # the library with no Node types, then the tests
pnpm run build:identity       # dist/cjs and dist/esm
pnpm exec hardhat test test/identity-library.test.ts   # against the deployed registry
```

The library's `tsconfig.json` has no Node types, so a Node-only API in `src/`
fails the typecheck. `test/no-network.test.ts` traps every Node and browser
way of opening a connection while the whole lifecycle runs, and checks that
`src/` imports nothing but ethers and noble's Ed25519.
