# Work Address contracts

The open contract half of Work Address, implementing the v1 rules in
`web/docs/smart-contracts/SPEC.md` — `MarketplaceEscrow` for settlement
(SC-ES-01..03, and ESC-04/05 in `web/docs/specification/escrow-payments.md`)
and `IdentityRegistry` for profile publication (SC-ID-01, SC-PR-01).

Both are immutable deployments with no owner, no pause and no upgrade hook.
Nothing here depends on the dashboard, the website or a hosted API: a verifier
needs an RPC endpoint and nothing else.

> **Unaudited. Not for real funds.** The release gate in SPEC §14 — independent
> security review, testnet pilot, reproducible verified deployment — has not
> been met. The Hardhat config has no public network on purpose.

## `MarketplaceEscrow`

One allocation is one worker and one period of accepted work:

| Step | Who | Rule |
| --- | --- | --- |
| `fund` | Payer | Exact budget, before work starts, with the platform's EIP-712 origin proof over every term |
| `cancelBeforeWork` | Payer | Full refund before work starts |
| `submitInvoice` | Payee | Once, from work end until work end + 72 hours; 0 < amount ≤ budget |
| `refundExpired` | Anyone | No submission by the deadline: full refund |
| `dispute` | Payer | Before submission + 7 days: the billed amount is refunded |
| `release` | Anyone | From submission + 7 days: 95% to the payee, 5% to the fixed fee recipient, atomically |
| `refundRemainder` | Anyone | Unbilled budget back to the payer, once |

Party actions also have relayed forms — `fundFor`, `cancelBeforeWorkFor`,
`submitInvoiceFor`, `disputeFor` — taking an EIP-712 `Action` signature bound to
the operation, allocation, exact payload, the signer's next nonce and a
deadline. Contract wallets sign through ERC-1271. Nonces are sequential per
signer, so a party's outstanding authorizations are used in the order signed.

There is no owner, pause, upgrade or withdrawal function. Recipients are fixed at
funding; permissionless calls cannot choose where money goes. For every
allocation `budget = held + workerTransferred + feeTransferred + clientRefunded`,
and the contract's token balance equals `totalHeld` (plus any surplus sent
directly, which is never credited).

## `IdentityRegistry`

A wallet-signed profile document already proves authorship without any chain.
The two things a signature cannot do are the only things this contract stores:
which version is **current**, and whether it has been **withdrawn**.

| Step | Who | Rule |
| --- | --- | --- |
| `publish` | Subject | Appends a version; legal when unpublished, active or withdrawn — the last case is reactivation |
| `deactivate` | Subject | Withdraws the current presentation; appends no version, and voids the subject's unsubmitted authorizations |
| `readIdentity` / `readIdentityAt` / `checkPresentation` | Anyone | What is current, what an older version held, and how a presented document compares |

`publishFor` and `deactivateFor` are the relayed forms, taking an EIP-712
`Action` bound to the operation, subject, payload, the subject's next nonce and
a deadline, with ERC-1271 for contract wallets — the same shape as the escrow,
under a different domain so the two can never be interchanged. There is
deliberately no `activate()`: re-exposing a withdrawn profile has to restate
what is being published.

**No profile content is on chain and none can be.** What gets published is
`profileCommitment(subject, schemaId, merkleRoot)` — a domain-separated hash of
a salted Merkle root, never the bare root. The contract cannot open it, which
keeps names, rates and links off a permanent ledger by construction rather than
by policy. Leaves bind the subject, so a stolen export cannot be transplanted
onto another record.

**There is no reputation contract, and that is a decision rather than a gap.**
The only reputation fact a chain can attest is that an address was paid an
amount by another address under known terms, and `MarketplaceEscrow` already
emits exactly that. A second record would restate a stronger source, and SPEC
§2 forbids a deployment that only buys a badge. Work receipts are signed
exports checked against escrow events plus `readAllocation` — and a verifier
must check the emitting contract against a published allowlist, because this
code is MIT and a self-funded clone emits a structurally perfect `Released`.

**Subjects are `did:pkh:eip155` only.** The record key is a 20-byte EVM
address, so there is nowhere to put a Solana ed25519 key or a TON
workchain:hash pair; the refusal is structural, not a rule a later change can
relax. Solana and TON accounts keep sign-in, profiles and the same portable
export, self-signed — they simply have no anchor. No `did:workaddress` is
minted and no DID Core conformance is claimed.

## Canonical encodings

The escrow stores four hashes it never opens: the allocation and obligation
ids, `termsHash` and `invoiceCommitment`. A worker who needs to submit an
invoice while the hosted services are down (SPEC §12), or anyone checking a
settlement, has to rebuild them byte for byte. This section says how.

### Funding terms: EIP-712 `Terms`

The platform's origin signature is EIP-712 over `Terms` (the field order is
`TERMS_TYPEHASH` in the contract), under the domain
`{ name: "WorkAddressMarketplaceEscrow", version: "1", chainId, verifyingContract }`.
`termsDigest(terms)` returns the digest on chain. The vector is
`test/fixtures/escrow-terms.contract.json`.

### Allocation and obligation ids

The marketplace API (`web/api/src/service/escrow-manager.ts`) derives them with
Solidity packed encoding. `contractId` is the marketplace contract's UUID as
text, and `workStart` and `workEnd` are Unix seconds:

```text
obligationId = keccak256(abi.encodePacked("work-address:contract-period", contractId, uint64 workStart, uint64 workEnd))
allocationId = keccak256(abi.encodePacked(uint256 chainId, address escrow, obligationId))
```

The contract does not check either derivation. It only requires both to be
non-zero and each to be unused.

### `termsHash`

`termsHash` is a commitment to the accepted terms document. The text itself
stays off chain. Today the marketplace API computes it as:

```text
termsHash = keccak256(UTF-8(JSON.stringify({
  contractId, title, paymentType, amount, weeklyLimit, startDate, terms
})))
```

The keys come in exactly that order and the JSON has no whitespace.
`contractId` is a UUID string. `title` and `terms` are free text (`terms` may be
`null`). `paymentType` is `HOURLY` or `FIXED`. `amount` is an integer of whole
USDT (per hour or in total). `weeklyLimit` is an integer or `null`, and
`startDate` is a `YYYY-MM-DD` string or `null`.

It is not RFC 8785. The key order is fixed by the code, not sorted, and the
free text is hashed as `JSON.stringify` escapes it. That output is
deterministic for this one shape, but it is not a published canonical form.
It has no salt either, so anyone holding the terms text can confirm a guess.
Moving it to JCS with vectors is open work on the marketplace API. Until then,
this paragraph is its specification.

### `invoiceCommitment` (InvoiceCommitment v1)

The payee's `submitInvoice` / `submitInvoiceFor` commits to one issued app
invoice, as captured in the invoice's frozen snapshot:

```text
commitment = keccak256(DOMAIN || salt || document)
           = keccak256(abi.encodePacked(DOMAIN, salt, bytes(document)))

DOMAIN   = keccak256(UTF-8("work-address/invoice-commitment/v1"))
         = 0x0e99e479fd427cdce7dee9378966edd2f8cc887862004a9d5f05d4d24f6f7d17
salt     = 32 bytes the issuer draws at random and keeps; never all zero
document = UTF-8 of the RFC 8785 (JCS) text of
           { "allocationId": <bytes32, lowercase 0x hex>,
             "chainId":      <integer>,
             "escrow":       <escrow address, lowercase 0x hex>,
             "record":       <the invoice's InvoiceRecord v1> }
```

- **InvoiceRecord v1** is the app's canonical invoice document
  (`GET /invoice/:id/record`, for the issuer and the project owner). It holds
  the invoice and project ids, the issuer id, the issuer and owner addresses
  in canonical form, `currency`, `rateHourCents`, `minutesActive`,
  `amountCents`, the period, and the billed `lines`. Every number is an
  integer, and timestamps are ISO-8601 UTC with milliseconds. The record
  comes from the snapshot frozen at issuance, so it is the same document on
  every read. JCS nests, so the record's own JCS text appears in `document`
  unchanged.
- **The binding** (`chainId`, `escrow`, `allocationId`) is committed. An
  opening therefore proves where the invoice was submitted as well as what it
  said. The same invoice and salt give a different commitment on any other
  chain, deployment or allocation.
- **The salt** keeps the commitment from being a guessable hash of public
  data. Without it, anyone who knows the ids and the rate could confirm a
  guessed invoice.
- **The on-chain amount is not in the document.** The escrow records `billed`
  itself, and in `submitInvoiceFor` the payee's signature covers
  `keccak256(abi.encode(invoiceCommitment, amount))`.

To open a commitment, the issuer discloses the record and the salt. A verifier
takes `chainId` from the node, `escrow` from the address that emitted
`InvoiceSubmitted`, and `allocationId` and `invoiceCommitment` from the event
(or `readAllocation`), recomputes the commitment, and compares. Change any
record field, any binding field or the salt, and the commitment no longer
matches.

This replaces the unsalted
`keccak256("work-address:invoice:<contractId>:<allocationId>:<amount>")`, which
anyone could recompute from public ids and which said nothing about the
invoice.

`scripts/invoice-commitment.ts` implements the encoding without the app, and
`test/invoice-commitment.test.ts` holds it to
`test/fixtures/invoice-commitment.v1.json`. Those vectors were produced by an
independent encoder, and the app (`app/api/src/service/invoice-commitment.ts`)
must reproduce them too. The same test deploys `MarketplaceEscrow` at the
vectors' escrow address, submits the vector commitments directly and relayed,
and opens them from chain data. A change that moves one byte of any output is
a new version with a new domain tag, not an edit.

## Develop

```bash
npm install
npm test
npm run typecheck
npm run deploy:local   # in-process smoke deploy; nothing outlives the command
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run build`, `npm test` and
`npx tsc --noEmit` on every push to `main` and every pull request, all on
Hardhat's in-process network. Run the same four before opening one. `tsc` is
not redundant with the tests: Hardhat loads TypeScript transpile-only, so a
type error in a test or script shows up nowhere else.

Two fixtures are byte-identical copies of files in other repositories, so
both sides are held to the same bytes (see "Canonical encodings"):

| Fixture | Other copy | What it pins |
| --- | --- | --- |
| `test/fixtures/escrow-terms.contract.json` | `web/api/src/test/fixture` | The EIP-712 `Terms` digest the marketplace API signs |
| `test/fixtures/invoice-commitment.v1.json` | `app/api/src/test/fixture` | InvoiceCommitment v1, which the app computes and the escrow stores |

Change a shared fixture in both places or in neither.
`invoice-commitment.v1.json` is also pinned by its SHA-256 in the test on each
side, so an edit to one copy fails that side's test until the other copy
matches.

## Run the whole flow locally

Everything here targets the local Hardhat chain, chain id 31337, and nothing
else. `hardhat.config.ts` defines no other network. Before sending anything,
deploy, mint and time-advance each ask the node for its chain id and refuse
any other; chain id 1 is refused by name.

1. **Start a node** in its own terminal. It keeps its state until you stop it
   with Ctrl-C. While idle it mines a block every 5 seconds, so the latest
   block's timestamp keeps up with the clock. The escrow panel reads that
   timestamp as "now".

   ```bash
   npm run node
   ```

   From the web repository, `docker compose -f docker-compose-dev.yml up chain`
   runs the same node in a container.

2. **Deploy** the test USDT, `MarketplaceEscrow` and `IdentityRegistry`:

   ```bash
   npm run deploy:localhost
   ```

   The token is `TetherLikeUSDT`, so the mainnet approve-reset rule applies
   locally too. Set `LOCAL_TOKEN=MockUSDT` for a plain ERC-20. The deploy
   writes `deployments/localhost.json` (the schema is
   `deployments/manifest.schema.json`; the file is git-ignored). It also
   prints the `APP_ESCROW_*` lines for `web/api/.env`. The node's account #0
   deploys, #1 receives the 5% fee and #2 is the origin signer. Hardhat prints
   #2's key on start, so the key in those lines is public. On a fresh node
   the addresses are always the same:

   | Contract | Address |
   | --- | --- |
   | `TetherLikeUSDT` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
   | `MarketplaceEscrow` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
   | `IdentityRegistry` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |

3. **Fund a wallet** with test USDT, in whole units. A wallet holding less
   than 1 ETH is topped up to 10 ETH for gas:

   ```bash
   npm run mint:localhost -- 0xYourWallet 1000
   ```

4. **Move time.** This calls `evm_increaseTime` and mines one block, so the new
   time is on chain. It takes seconds, or a number ending in `s`, `m`, `h` or `d`:

   ```bash
   npm run time:advance -- 8d
   ```

### Walkthrough: fund, advance, submit, advance, release

The scripted version uses the node's account #3 as the client and #4 as the
worker. It funds 120 USDT, advances to the end of work, bills 100, advances
past the 7-day dispute window, releases the bill and refunds the unbilled
remainder:

```bash
npm run walkthrough:localhost
```

```text
1. fund      client 0x90F79bf6EB2c4f870365E785982E1f101E93b906 funded 120.0 USDT
2. advance   chain time is now … (work end)
3. submit    worker 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 billed 100.0 USDT
4. advance   chain time is now … (dispute window over)
5. release   worker +95.0 USDT, fee recipient +5.0 USDT, client refunded 20.0 USDT (spent 100.0 USDT)
```

The same steps through the site:

1. Paste the printed `APP_ESCROW_*` lines into `web/api/.env` and restart the
   API. `GET /escrow/config` now returns `enabled: true`, and the escrow panel
   appears on ACTIVE contracts.
2. Mint to the client's browser wallet (step 3 above), or import account #3's
   key. If the wallet does not know chain 31337, connecting offers to add
   "Hardhat Local" at `http://127.0.0.1:8545`.
3. As the client, prepare a period that starts soon, then fund it.
4. `npm run time:advance -- <seconds until work end>`, then submit the invoice
   as the freelancer.
5. `npm run time:advance -- 7d`, then release. The freelancer receives 95% and
   account #1 receives 5%. Refund-remainder returns any unbilled budget.

Two things to know:

- Only the chain's clock moves. The API signs terms against the wall clock,
  with an origin expiry at most `APP_ESCROW_ORIGIN_TTL_SECONDS` away. Once the
  chain is further ahead than that TTL, it rejects every new signature as
  expired. The scripted walkthrough moves the chain 8 days ahead, so run the
  site steps on a fresh node.
- Restarting the node wipes every contract, while `deployments/localhost.json`
  remains. Mint and the walkthrough detect this and ask you to deploy again,
  which brings back the same addresses. MetaMask also caches nonces for each
  chain, so after a restart clear the account's activity data.

## Settlement asset

**Ethereum mainnet, Tether USDT** at `0xdAC17F958D2ee523a2206206994597C13D831ec7`,
6 decimals — DEC-09, decided 17 September 2026. No bridged or look-alike
variant. How it differs from a standard ERC-20, and what that means here:

| USDT behaviour | Effect on the escrow |
| --- | --- |
| `transfer`, `transferFrom` and `approve` return nothing | Handled by SafeERC20. `test/usdt-mainnet.test.ts` is the only suite that guards this: replace any `safeTransfer` with `transfer` and the other suites still pass while every mainnet payout would revert |
| The blacklist checks the **sender** only | A blacklisted payee or fee recipient is still paid. A blacklisted payer cannot fund, and nothing is recorded |
| Blacklisting the escrow address, or pausing USDT | Every exit reverts until the issuer lifts it. Nothing is lost or reassigned, but nobody — including the deployer — can move the funds meanwhile. An accepted issuer risk that the public terms must state |
| An issuer transfer fee (currently 0) | Funding fails closed with `IncompleteTransfer`. If switched on after funding, the escrow's books stay exact and recipients receive less by the token's fee |
| A non-zero allowance must be reset to zero first | The escrow never approves. A client wallet raising a stale allowance must send `approve(0)` first |

## Still open before any deployment

- Whether the registry is deployed on the same chain as the escrow. One chain
  means a verifier needs one RPC endpoint and one reorg policy; it also
  permanently joins a wallet's profile-edit rhythm to its earnings graph. That
  is a product trade, not an ops convenience.
- Uniqueness of an obligation across future contract versions (SC-DEC-03), and
  who publishes and signs the official deployment allowlist — with no on-chain
  reputation, that manifest is the trust root for every settlement receipt.
- Schema v1's slot table: which public profile fields occupy which of the 32
  leaves. It must be written fresh rather than reusing the current public
  profile serialization, which still leaks email, phone and roles (PRODUCT G13).
- Salt custody, for profile and invoice commitments alike. If the hosted API
  holds both values and salts, the commitment protects privacy against chain
  observers but not against us, and the docs must say so. InvoiceCommitment v1
  fixes the encoding, not who keeps an invoice's salt.
- Independent review, testnet pilot and a verified, reproducible deployment —
  the SPEC §14 gate, unmet for both contracts.
