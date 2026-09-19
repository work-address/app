# Domain specification

This file governs the **domain model** only. The product description — features,
users, pricing, phases and the discrepancy register — is `PRODUCT.md` in the
`work-address/web` repository.

Work Address has **five core domains and no others**:

| Domain | What it owns |
| --- | --- |
| `User` | Identity. A wallet address, a profile, roles, the premium flag. |
| `Project` | A body of work, its hourly rate, and who may touch it — `workerAddresses` / `viewerAddresses`, resolved to `workers: User[]` / `viewers: User[]`. |
| `Time` | The work record. Tracked entries with activity data, and `isPaid`. |
| `Invoice` | The money record. A period of one person's time, an amount, the financial snapshot the amount was computed from, and whether it was paid. |
| `ProjectStatistics` | Derived aggregates over `Time`, for reporting. |

## No new domains

**Do not add a domain unless there is no way to express the requirement with
these five.** That bar is deliberately high, and it has already been applied:

- **Timesheets** were a separate entity holding a period of a worker's time,
  an amount, and an approval state. That is an invoice. Deleted.
- **Project invites** were a separate entity for adding a collaborator. A
  collaborator is an address on `Project.workerAddresses`. Deleted.
- **Contractor documents** were a separate entity for tax forms. Nothing in
  the product needed them to exist. Deleted.
- **Payout runs** were a separate aggregation over timesheets. Invoices already
  aggregate; an unpaid invoice *is* a payout waiting to happen. Deleted.
- **Employer contractor reports** were a separate query surface over `Time`.
  `ProjectStatistics` already covers reporting. Deleted.

Each of these looked reasonable in isolation. Together they duplicated
`Invoice` and `Project`, split the meaning of `Time.isPaid` across two owners,
and produced two records of the same economic event that could disagree.

Before adding a sixth domain, write down which of the five cannot hold the
data and why. If the answer is "it would be tidier", the answer is no.

## Time and Invoice are the truth points

Everything about work done and money owed resolves to these two:

- **`Time` is the only record of work.** Nothing else stores hours.
- **`Invoice` is the only record of money.** Nothing else stores an amount
  owed, and nothing else decides whether an hour has been paid for.

### The rules that keep them consistent

**A slice of time belongs to its author.** Every tracker cuts time into the
same buckets, so two people tracking one project at once send the same
`fromAt`. Each keeps their own row: the key is (project, author, `fromAt`),
and a project's totals count every author's rows. The same author sending a
slice again updates their own row. Nobody else's row is ever touched.

**A slice claims only what a tracker could have recorded.** Invoices bill
`minutesActive`, so the server bounds every row `POST /time` receives
(`TimeBounds`): `fromAt` before `toAt` and at most 60 minutes apart, `toAt`
at most 5 minutes past the server's clock, `minutesActive` from 0 to the
slice's length in minutes, and no negative activity counter. A row that
breaks a rule is refused in its own slot of the batch, naming the field and
the rule, and the rest of the batch is stored.

**An invoice covers exactly one person's hours.** Whoever issued it
(`Invoice.user`) is the person whose time it bills for — a worker invoices the
project owner for their own hours, an owner invoices their client for theirs.
One invoice never sums several contributors together, because the resulting
record would name nobody and leave the contributors with nothing of their own.

**`Time.isPaid` is owned by `Invoice`.** `InvoiceManager.markPaid` sets it and
`markUnpaid` clears it, on exactly the entries linked to that invoice. An
author may also set it by hand — one entry in the time dialog
(`PUT /time/:id`), or in bulk through `POST /time/paid` and `/time/unpaid` —
but only on entries no invoice covers. A request that would change it on an
invoiced entry is refused whole with a 409 naming the invoice, and the worklog
table, dialog and bulk actions disable the control for such entries and say
why: the payment is changed on the invoice.

This is what stops the work record and the money record from drifting.

**Only the issuer may mark an invoice paid.** The person owed the money is the
one who knows whether it arrived; letting the payer self-certify would make the
record worth less than the wallet history it summarises.

**An hour is billed once.** Every way of raising an invoice — a selection, a
range, or everything outstanding — considers only time that is unpaid *and*
not yet linked to an invoice (`Time.invoice`), and the link is written under
that same condition, so an entry on one invoice is never moved to another.
Reading the entries, saving the invoice and linking them happen in one
transaction with the entries locked: two requests at once cannot both bill
the same hour, and a failure part-way leaves no invoice behind. Marking an
invoice paid or unpaid changes its state and its entries' `isPaid` in one
transaction as well.

**Money is integer cents.** `Invoice.amountCents`, never a float — a float
cannot represent every cent exactly, so sums drift and two clients can render
the same row differently. It becomes a decimal string only at the UI edge.

**An issued invoice keeps its own breakdown (DEC-04).** The amount is not
the only thing frozen at issuance: in the same write, the invoice records the
snapshot it was computed from — `snapshotVersion`, the issuer's and the
project owner's addresses in canonical form, `rateHourCents`, `currency`
(USD), the total `minutesActive`, and the billed `lines` (each entry's
`timeId`, `fromAt`, `toAt` and `minutesActive`). `amountCents` is that
snapshot's own arithmetic — active minutes × rate ÷ 60, rounded once, half
up — so the record always explains its total. None of it is ever updated:
changing the project's rate or clearing an entry's screenshots or processes
changes nothing the invoice billed, and the invoice page reads its rate,
minutes and lines from the snapshot. The snapshot is
columns on `Invoice`, not a domain of its own.

- Monitoring evidence stays deletable. Screenshots and processes can be
  cleared from an invoiced entry; the invoice never depended on them.
- A tracker re-sync cannot rewrite a settled entry — one an invoice bills,
  or one marked paid. `POST /time` refuses that row alone with a 409 naming
  the invoice and the fields it would have changed, and the entry stays as
  billed. Re-sending the same values changes nothing and is answered with
  the entry's id, so a retrying tracker is not told it failed.
- An entry an invoice bills cannot be deleted. `DELETE /time` refuses the
  whole request with a 409 naming the invoice, and the worklogs offer no
  delete for such entries.
- A mistake is corrected by a new invoice referencing the original, never
  by editing an issued one or the entries under it. Nothing records that
  reference yet; how a correction links to what it corrects is still an
  open policy decision.
- Invoices issued before snapshots are **legacy** (`snapshotVersion` 0, set
  by the one-off `backfill:invoice-snapshot` script). They keep their frozen
  amount and report no rate: the rate they were raised at was never
  recorded, and today's project rate is not it.

The snapshot serialises to **InvoiceRecord v1** (`GET /invoice/:id/record`,
for the issuer and the owner): RFC 8785 canonical JSON, integers only,
UTC timestamps with milliseconds, lines ordered by start then id, and no
paid state. It is the document an escrow invoice commitment hashes, so its
bytes are a published format — `api/src/test/fixture/invoice-record.v1.json`
holds the vectors, and a change that moves one byte needs a new version. A
legacy invoice has no record.

**InvoiceCommitment v1** is what a worker submits to the escrow instead of the
invoice (`InvoiceCommitment`, `api/src/service/invoice-commitment.ts`):
`keccak256(DOMAIN || salt || document)`, where `DOMAIN` is keccak256 of
`work-address/invoice-commitment/v1`, the salt is 32 random bytes the issuer
keeps, and the document is the RFC 8785 text of `{ allocationId, chainId,
escrow, record }` with the invoice's InvoiceRecord v1 as `record`. Disclosing
the record and the salt opens it against chain data alone; without the salt
it cannot be recomputed from public ids. The vectors in
`api/src/test/fixture/invoice-commitment.v1.json` are byte-identical to the
contracts repository's `test/fixtures` copy, which is checked against
`MarketplaceEscrow` itself, and the contracts README specifies the encoding.

**Retention never destroys an invoice's evidence.** The free-tier purge skips
entries covered by an invoice from the same issuer, so a financial record
always keeps the detail behind it.

## Who can see what

| | Project time and statistics | Own invoices | Others' invoices |
| --- | --- | --- | --- |
| Project owner | yes | yes | yes |
| Project worker | yes | yes | **no** |
| Project viewer | yes | **no** | **no** |

A worker sees their own invoices only: one contractor's rate and hours are not
another contractor's business.

**A viewer sees no invoices at all.** The role exists to watch progress, not
money. The rate-privacy reason given above for workers applies to a viewer more
strongly, not less: a viewer added to a project with several contributors would
otherwise read every contributor's rate, and a viewer is typically further from
those contributors than a fellow worker is.

Invoice access follows the issuer, not the issuer's current role: a worker who
is later moved to the viewer list still sees the invoices they raised. It is
their own record of money owed to them.

There is no mechanism for granting an outsider access to a single invoice. An
invoice leaves the product as a PDF, sent by the issuer.

**An address on a list names one account, by that account's chain rules.**
An EVM address matches whatever its casing, and a TON address in either
spelling (raw or friendly). A Solana address matches only exactly: base58 is
case-sensitive, so two addresses that differ only in case are two accounts.
`WalletAddress.isSame` is the rule. The SQL access filters, the
worker/viewer resolution and the public profile lookup by address
(`GET /user/:address/address`) use its SQL form (`WalletAddress.canonicalSql`
and `sqlListContains`), so a query and `Project.isWorker` always give the
same answer.

## What premium governs

**Collaborators are free.** Adding a worker or a viewer costs nothing and is
not gated. Project access is address membership alone: the owner's plan is not
part of any access check, so a subscription that lapses or resumes neither
removes nor restores anyone's access. The same holds on a self-hosted instance,
where a worker invoices exactly as on the hosted service.

Premium governs **how long recorded time is kept**, and nothing else. On the
hosted service an unpaid workspace rotates timelogs at 14 days; paying converts
the whole workspace so nothing rotates. The retention check in `TimeManager` is
the only code that asks `Entitlement` whether an account is premium. A
self-hosted instance is unconditionally entitled — unlimited seats, no rotation
(see `service/entitlement.ts`).

Retention is a property of the workspace, never of one person: `ProjectStatistics`
and invoice reports aggregate across contributors, so a project whose
contributors had different retention would report totals that quietly disagree
with the work done.
