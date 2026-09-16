# Work Address contracts

Open-source marketplace escrow for Work Address, implementing the v1 rules in
`web/docs/smart-contracts/SPEC.md` (SC-ES-01..03) and
`web/docs/specification/escrow-payments.md` (ESC-04/05).

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

## Develop

```bash
npm install
npm test
npm run deploy:local
```

`test/fixtures/escrow-terms.contract.json` is shared with the marketplace API
(`web/api/src/test/fixture`), so both sides agree on the signed terms digest.

## Still open before any deployment

- Chain, exact USDT asset and confirmation rule (DEC-09).
- Uniqueness of an obligation across future contract versions (SC-DEC-03).
- Independent review, testnet pilot and a verified, reproducible deployment.
