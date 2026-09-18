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

## Develop

```bash
npm install
npm test
npm run deploy:local
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run build`, `npm test` and
`npx tsc --noEmit` on every push to `main` and every pull request, all on
Hardhat's in-process network. Run the same four before opening one. `tsc` is
not redundant with the tests: Hardhat loads TypeScript transpile-only, so a
type error in a test or script shows up nowhere else.

`test/fixtures/escrow-terms.contract.json` is shared with the marketplace API
(`web/api/src/test/fixture`), so both sides agree on the signed terms digest.

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
- Salt custody. If the hosted API holds both values and salts, the commitment
  protects privacy against chain observers but not against us, and the docs
  must say so.
- Independent review, testnet pilot and a verified, reproducible deployment —
  the SPEC §14 gate, unmet for both contracts.
