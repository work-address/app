# @work-address/identity

Builds, presents and checks Work Address profile commitments under
[profile schema v1](../../docs/profile-schema-v1.md). It is the open library
side of `IdentityRegistry`: the contract stores a commitment it cannot open,
and this package is how a holder produces one and how anyone checks what the
holder later shows.

- **Pure computation at the core.** Building, presenting and checking a
  document offline makes no network call and holds no key. Randomness comes
  from Web Crypto `getRandomValues`. It runs in a browser and in Node 19 or
  later.
- **An independent verifier on top.** `verifyPresentation` makes the one chain
  call a verifier needs, `checkPresentation`, through an `RpcRequest` the
  caller hands it: a JSON-RPC endpoint of their choosing and nothing else. No
  Work Address host is contacted, and none could change the answer. See
  [Verifying independently](#verifying-independently).
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

## Verifying independently

Anyone can check a Work Address identity with three things: the presentation
the holder handed over, a deployment manifest naming the registry they accept,
and an RPC endpoint they trust. Nothing else is asked, of anyone.

From a clean checkout of this repository:

```bash
pnpm install --frozen-lockfile        # at the repository root
contracts/packages/identity/bin/verify identity presentation.json \
  --manifest contracts/deployments/localhost.json \
  --rpc http://127.0.0.1:8545
```

```
Result: Current
This is the subject's current published version, and it stands, as of finalized block 128
Subject: did:pkh:eip155:31337:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Registry: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 on chain 31337, version 1
  /name = "Margaret Hamilton"
Block checked: 128 (finalized)
```

`bin/verify` runs the TypeScript source through ts-node, so in a checkout it is
never a stale build. `--json` prints the whole report, `--subject <address>`
refuses a document about any other account, and `--finality latest` reads the
head alone, for a development chain. `bin/verify origin certificate.json
[--signer <address>]` opens an origin certificate offline (`src/origin.ts`);
`bin/verify receipts` and `bin/verify receipt` build and check settlement
receipts (below).

| Exit | Meaning |
| --- | --- |
| 0 | Verified: `Current`, or `SelfSignedOnly` (authorship only, and the output says so) |
| 1 | Refuted or not recognised: every other result |
| 2 | The command line, a file or the manifest could not be read |
| 3 | Undetermined: `RpcUnavailable`, `NotFinal`, or a certificate whose terms are unproven. Not a failed proof, and not a pass |

The block checked is printed on every run, whatever the result.

```ts
import { jsonRpcTransport, verifyPresentation, isWithdrawn } from '@work-address/identity'

const report = await verifyPresentation(presentationText, {
  manifest,                                   // deployments/<network>.json, or a list of them
  rpc: jsonRpcTransport('https://your.rpc'),  // or any (method, params) => Promise, e.g. a wallet's request
  expectedSubject: address,                   // optional
})

report.result          // 'Current', 'Superseded', ..., see below
report.checkedAtBlock  // the block the answer is for; null when no chain was read
isWithdrawn(report)    // Deactivated, or an old version of a profile since withdrawn
```

What it does, in order: checks the document offline (shape, schema, subject,
every proof, and the commitment **recomputed** from the root, because the
registry stores bytes it cannot open); holds the anchor's registry to the
manifest; asks the endpoint for its chain id, its head and its finalized
block; and calls `checkPresentation` at both blocks by number. Only an answer
the finalized block and the head agree on is reported as that answer.

| Result | Meaning |
| --- | --- |
| `Current` | The subject's current version, and it stands |
| `Superseded` | A newer version exists. With `subjectDeactivated`, the profile has since been withdrawn: show it as taken down, not as out of date |
| `Deactivated` | This was the current version when the subject withdrew the profile |
| `Unpublished`, `VersionUnknown`, `CommitmentMismatch`, `SchemaMismatch` | The registry does not hold this document as that version. `CommitmentMismatch` is also the offline answer when the document's commitment is not the one its root gives |
| `RegistryNotInManifest` | The anchor names a registry the manifest does not list. A copy of the registry runs the same scheme and proves nothing; it is never asked |
| `InvalidProof` | A disclosed value, salt, slot or proof does not open against the root |
| `MalformedExport`, `UnsupportedSchema`, `UnsupportedSubjectScheme` | Not a document this verifier can read |
| `SelfSignedOnly` | A valid wallet signature and no anchor: authorship, with no answer about currency or withdrawal |
| `SignatureInvalid` | The self-signature is not the subject's |
| `SubjectMismatch` | The document is about another account than `expectedSubject` |
| `RpcUnavailable` | The endpoint did not answer, answers for another chain, or has no registry at that address. **Not a statement about the document** |
| `NotFinal` | The head and the finalized block disagree, or the node names no finalized block. Check again later |

### Settlement receipts

There is no receipts or reputation contract, by decision: the escrow's
`Released` event already is the only reputation fact a chain can attest. A
receipt (`work-address/settlement-receipt` v1, claim type `escrow-release`) is
a reference to that event, and everything in it is re-read from the chain.

```bash
bin/verify receipts --subject 0xWorker --manifest deployments/localhost.json --rpc http://127.0.0.1:8545 --out receipts/
bin/verify receipt receipts/*.json --manifest deployments/localhost.json --rpc http://127.0.0.1:8545 \
  --subject 0xWorker --certificate origin.json
```

```ts
import { buildReceipts, findAllocationsPaidTo, verifyReceipts } from '@work-address/identity'

const allocationIds = await findAllocationsPaidTo(worker, { manifest, rpc })   // or hints from anywhere
const { receipts, allocations } = await buildReceipts({ subject: worker, allocationIds }, { manifest, rpc })
const { reports, summary } = await verifyReceipts(receipts, { manifest, rpc, expectedSubject: worker })
```

`buildReceipts` reads `readAllocation` at the finalized block, requires
`Released` with the subject as payee and another wallet as payer, finds the
one `Released` log on a manifest-listed escrow, and checks gross = billed,
workerNet = workerTransferred, fee = feeTransferred. Every other allocation
is reported with what became of it: `CancelledBeforeWork`, `ExpiredRefunded`,
`DisputeRefunded`, `Funded`, `Submitted`, `NotFound`, `PayeeMismatch`,
`SelfPaid`, `OutcomeMismatch`, `NotFinal`. None of those is an earnings
receipt. Allocation ids are hints: a wrong one can only produce `NotFound`.
`AllocationFunded` does not index the payee, so `findAllocationsPaidTo` reads
every funding event since the deployment block; that is the cost of asking
nobody.

`verifyReceipt` answers `Verified`, `NotFound` (never there, or reorganised
away), `NotReleased`, `RegistryNotInManifest`, `SubjectMismatch`,
`OutcomeMismatch`, `TermsMismatch`, `MalformedReceipt`, `SignatureInvalid`,
`RpcUnavailable` or `NotFinal`. `verifyReceipts` counts an allocation once
however many receipts name it. With an origin certificate it also opens the
`termsHash`: the disclosed terms are the ones this payment was made under,
signed by the `originSigner()` the escrow itself reports. A certificate that
declares format version null (a hire accepted under the v2 terms as they were
before they named their origin) leaves the terms `unproven`, said in words,
and the payment still verifies.

A verified receipt says a wallet was paid an amount by another wallet through
a listed escrow. It does not say the work was good or that the two wallets
are independent people; a UI must keep that qualifier next to the number and
must never fold receipts into a rating.

`rpc.ts` is the only file in `src/` that names a network API. It posts JSON-RPC
to the URL it was given, with no credentials and no redirects, and
`test/no-network.test.ts` holds it to that.

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
pnpm run test:identity        # mocha: vectors, tampering, trees, documents, the verifier on a scripted chain, no network
pnpm run typecheck:identity   # the library with no Node types, then the command, then the tests
pnpm run build:identity       # dist/cjs, dist/esm and dist/node (the command)
pnpm exec hardhat test test/identity-library.test.ts   # against the deployed registry
pnpm exec hardhat test test/identity-verify.test.ts    # the verifier and bin/verify against the deployed registry
pnpm exec hardhat test test/settlement-receipts.test.ts  # receipts against the deployed escrow (ID-09)
```

### Copies in other repositories

The marketplace website builds from its own repository and Docker context, so
it cannot depend on this package; it carries a byte-for-byte copy in
`web/packages/identity`, as `api/src/vendor/identity` does here. After a
change to `src/`, commit it, then:

```bash
node contracts/packages/identity/scripts/vendor.cjs ../web/packages/identity
```

That copies `src/*.ts` and the vectors and writes `SOURCE.json` (this
repository's commit and the SHA-256 of every file), which the website's own
suite holds its copy to. Never edit a copy.

The library's `tsconfig.json` has no Node types, so a Node-only API in `src/`
fails the typecheck; the command lives in `cli/`, outside it. `test/no-network.test.ts`
traps every Node and browser way of opening a connection while the whole
lifecycle runs, and checks that `src/` imports nothing but ethers and noble's
Ed25519. The Hardhat suites run on the chain inside the test program and serve
it over a loopback port the system picks, so they never need, or touch, a node
on 8545.
