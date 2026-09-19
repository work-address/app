# Profile schema v1

Schema id **1** says which public profile field sits in which of the 32 leaves
that `IdentityRegistry` commits to, and how each value is turned into bytes.
Anyone holding a disclosed field, its salt and its 5-element proof can check it
against a published commitment with this document and an RPC endpoint alone.

- **Status:** written; unaudited like the contracts it serves (SPEC §14).
- **What it binds:** `IdentityRegistry.PROFILE_LEAF_TYPEHASH` and
  `profileCommitment()`. The contract stays the source of truth for the leaf
  and commitment formulas. This document adds the slot table and the value
  encoding the contract cannot express.
- **Vectors:** `test/fixtures/profile-schema-v1.vectors.json`, checked by
  `test/profile-schema-v1.test.ts`.
- **Not a standard.** The subject is named with `did:pkh`, but no DID method,
  resolver or DID Core conformance is claimed, and a presentation is not a
  Verifiable Credential. It is a person describing themselves: nothing here is
  checked by an employer, a client or the platform.

## Decisions this schema records

The owner has not yet ruled on these. Each one is the development plan's
proposal, adopted so the schema can be written; changing one later means a
new schema id, not an edit.

1. **Which fields.** Only what the public profile shows (PRODUCT.md §4.7): name,
   title, company, bio, hourly rate, skills, location and social links. Each
   one sits in a fixed slot. The source for every slot is the app's `User`
   record in its `public` projection. The marketplace `TalentProfile` in
   `web/api` (headline, category, availability, languages, portfolio links and
   its integer `hourlyRate`) is not in v1. So there is one rate and one source,
   and nothing needs reconciling. A later schema can add marketplace fields in
   the reserved slots.
2. **Never email, phone, roles or premium,** nor anything else outside that
   list (see "Excluded fields"). The slot table is written from PRODUCT.md
   §4.7, not from the API's `search` serialization, which used to leak contact
   details (PRODUCT G13).
3. **Per-field random salts.** Every field gets its own 32 CSPRNG bytes, drawn
   again for every published version. With one shared salt, disclosing one
   field would hand over the key for brute-forcing every other.
4. **Salt custody.** Salts and fillers are drawn on the holder's device. The
   private export, which holds every value, salt and filler, stays with the
   holder. A hosted service is only ever given a presentation, so it holds the
   salts of fields the holder chose to show in public. Those values are public
   anyway, so their salts protect nothing. A service that stored the private
   export as well would see every field in plain text, and would have to say so.
5. **Canonical values are RFC 8785 (JCS)** of the value after Unicode NFC.

Still open and not settled here: whether the registry shares the escrow's
chain. The schema does not depend on it, because the commitment binds the
chain id and registry address whatever they turn out to be.

## The commitment

For a subject `S` (a 20-byte EVM address) and schema id `1`:

```text
pathHash  = keccak256(UTF-8(pointer))
valueHash = keccak256(UTF-8(JCS(value)))
leaf      = keccak256(bytes.concat(keccak256(abi.encode(
              PROFILE_LEAF_TYPEHASH, uint32 1, address S, uint16 slot,
              bytes32 pathHash, bytes32 valueHash, bytes32 salt))))

PROFILE_LEAF_TYPEHASH = keccak256("ProfileLeaf(uint32 schemaId,address subject,uint16 slot,bytes32 pathHash,bytes32 valueHash,bytes32 salt)")
                      = 0xbc0ad1be262a3d9761ac0eb68104f83a8f7886fe415ed8596378167b732a987f
```

- **Exactly 32 leaves.** `leaves[i]` belongs to slot `i`. A slot with no field
  holds a **filler**: 32 CSPRNG bytes used as the leaf itself. A filler looks
  the same as a real leaf, so the tree does not reveal how many fields a person
  filled in.
- **Internal nodes hash the sorted pair:** `node = keccak256(min(a, b) || max(a, b))`,
  as OpenZeppelin's `Hashes.commutativeKeccak256` does. Levels are built from
  adjacent pairs `(2i, 2i + 1)`, so the root depends on each leaf's position.
- **Every proof has 5 elements**: the siblings from the leaf level up. It
  verifies with OpenZeppelin's `MerkleProof.verify(proof, root, leaf)`.
- **What is published** is never the root:

  ```text
  commitment = profileCommitment(S, 1, root)
             = keccak256(abi.encode(PROFILE_COMMITMENT_TYPEHASH, chainId, registry, S, uint32 1, root))
  ```

  It binds the chain, the registry deployment and the subject, so the same
  tree cannot be republished under another record.

## Slot table

`Source` is the column the value is read from: `app` repository, `User` entity
(`app/api/src/entity/user.ts`), always in the `public` projection that
`GET /user/:address/address` serves. Lengths count Unicode code points after
normalization.

| Slot | Pointer | Source (repo, entity, column) | Type | Max length | Encoding |
| --- | --- | --- | --- | --- | --- |
| 0 | `/name` | app, `User`, `name` | text | 256 | text rule |
| 1 | `/title` | app, `User`, `title` | text | 256 | text rule |
| 2 | `/company` | app, `User`, `company` | text | 256 | text rule |
| 3 | `/bio` | app, `User`, `bio` | text (the stored HTML fragment) | 16384 | text rule; committed as stored markup, which a verifier must sanitize before rendering |
| 4 | `/rate` | app, `User`, `rate` (`decimal(6,2)`, USDT per hour) | object | `rateHourCents` 1 to 999999 | rate rule |
| 5 | `/skills` | app, `User`, `skills` (comma-separated text) | array of text | 64 items of 128 | skills rule |
| 6 | `/location/city` | app, `User`, `city` | text | 256 | text rule |
| 7 | `/location/country` | app, `User`, `country` | ISO 3166-1 alpha-2 code | 2 | text rule, then exactly two ASCII capitals |
| 8 | `/social/facebook` | app, `User`, `facebook` | handle | 256 | text rule |
| 9 | `/social/linkedIn` | app, `User`, `linkedIn` | handle | 256 | text rule |
| 10 | `/social/twitter` | app, `User`, `twitter` | handle | 256 | text rule |
| 11 | `/social/instagram` | app, `User`, `instagram` | handle | 256 | text rule |
| 12 | `/social/youtube` | app, `User`, `youtube` | handle | 256 | text rule |
| 13 | `/social/telegram` | app, `User`, `telegram` | handle | 256 | text rule |
| 14 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 15 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 16 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 17 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 18 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 19 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 20 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 21 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 22 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 23 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 24 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 25 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 26 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 27 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 28 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 29 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 30 | reserved | none | filler | 32 bytes | always a filler in v1 |
| 31 | reserved | none | filler | 32 bytes | always a filler in v1 |

Pointers are RFC 6901 JSON Pointers into the profile document these fields
make up together, for example `{"name": …, "location": {"city": …}}`. Only
their exact text matters, through `pathHash`. A verifier refuses a disclosure
whose pointer is not the one this table gives its slot, and refuses any
disclosure of a reserved slot.

The social values are handles, not URLs. The app builds the link, for example
`https://linkedin.com/in/<handle>` or `https://t.me/<handle>`.

## Value encoding

A field is either **absent**, and its slot holds a filler, or it has exactly
one canonical value. The rules take the stored column and produce that value:

- **Text rule.** Take the stored string, remove leading and trailing
  whitespace as ECMAScript `String.prototype.trim` defines it, and apply
  Unicode NFC. An empty result, or a `null` column, means absent. The result
  must fit the slot's maximum length, or the field cannot be committed.
- **Rate rule.** Absent if the column is `null`, empty or zero; zero is the
  column default and means "never set". Otherwise the value is
  `{"currency": "USDT", "rateHourCents": <integer>}`, where `rateHourCents` is
  the rate in hundredths of one USDT per hour. `85.5` becomes `8550`. It is
  converted from the decimal text without floating point. The app shows this
  rate in USDT per hour, and the name follows InvoiceRecord v1's
  `rateHourCents`.
- **Skills rule.** Split the stored text on `,`. Apply the text rule to each
  part and drop the empty ones, keeping order and duplicates. That is exactly
  what the public profile shows. An empty list means absent. At most 64 items
  of at most 128 code points each.

The committed bytes are `UTF-8(JCS(value))`, where JCS is RFC 8785: object keys
sorted by UTF-16 code unit, no whitespace, and strings escaped exactly as
ECMAScript `JSON.stringify` escapes them (`\"`, `\\`, `\b`, `\f`, `\n`, `\r`,
`\t`, other controls below U+0020 as lowercase `\u00XX`, and everything else,
U+2028 included, as literal UTF-8). Integers are safe integers written in
decimal. Nothing in schema v1 is a fraction. A string containing a lone
surrogate has no canonical form and cannot be committed.

A value is only valid in canonical form. A verifier checks that every
disclosed string is already trimmed and NFC and within its limits, and refuses
it otherwise instead of normalizing it. So each field has exactly one accepted
byte string.

## Excluded fields

These never occupy a slot in v1, whatever a later API projection exposes:

| Field | Why |
| --- | --- |
| `email`, `phone`, `whatsapp` | Contact details. They reach a person, and PRODUCT G13 was about exactly this leak |
| `roles` | Authorization state, not self-description |
| `premium` | Says what the person pays for, and is not a credential (PRODUCT §5) |
| `tz` | Captured automatically from the device on activity, and not shown on the profile |
| `id`, `createdAt`, `updatedAt` and other bookkeeping columns | Internal identifiers and timestamps |
| `address` | It is the subject, bound into every leaf, not a field |
| Projects, worklogs, time entries, invoices | PRODUCT §4.7: never reachable from the public profile |
| Marketplace `TalentProfile` fields, reputation, feedback, escrow data | Not in v1 (decision 1). Payment facts come from escrow events, not from a self-declared profile |

## Subjects

The subject is the EVM account that publishes to `IdentityRegistry`. Its DID
string is `did:pkh:eip155:<chainId>:<EIP-55 address>`, where `chainId` is the
registry's chain. The leaf binds the 20-byte address, so a leaf opened for one
subject cannot be replayed under another.

## Test vectors

`test/fixtures/profile-schema-v1.vectors.json` has three cases:

1. a full profile with every field,
2. a sparse profile with two fields and thirty fillers, where a zero rate and
   empty text count as absent, and
3. non-ASCII input given in NFD with padding, committed as trimmed NFC. Its bio
   holds quotes, a backslash, a tab, a newline, U+0001, U+2028 and an emoji ZWJ
   sequence.

Each case gives the app record it maps from, the subject, every field's
pointer, value, JCS text, salt, `pathHash`, `valueHash`, leaf and 5-element
proof, the fillers, all 32 leaves, the root and the commitment. The chain is
31337, and the registry is where the test deploys it: the first contract
created by the key-less address `0x…1de0`.

The vectors are written by `test/fixtures/profile-schema-v1.vectors.py`. It
uses only the Python standard library, including its own Keccak-256, ABI
encoding, JCS, EIP-55 and CREATE address, and shares no code with the
TypeScript here. To regenerate:

```bash
python3 test/fixtures/profile-schema-v1.vectors.py > test/fixtures/profile-schema-v1.vectors.json
```

The Hardhat test pins the file's SHA-256, then recomputes everything in
Solidity. It computes every `pathHash`, `valueHash` and leaf with the deployed
registry's `PROFILE_LEAF_TYPEHASH`, and every root with
`Hashes.commutativeKeccak256`. It verifies every proof with
`MerkleProof.verify`, and checks that a flipped bit in a salt, a proof element
or the root fails. It checks every commitment against
`registry.profileCommitment()`, then publishes it and reads it back as
`Current` through `checkPresentation`. The vector salts and fillers are
derived from labels so the file regenerates byte for byte. Real ones come from
a CSPRNG.

## Changing the schema

A published commitment has to stay checkable for as long as anyone holds a
presentation of it. So schema v1 is never edited: moving a slot, renaming a
pointer, changing an encoding rule or adding a field is schema 2, with its own
id and vectors. Schema id 0 is reserved by the registry and means "no schema".
