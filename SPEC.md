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
| `Invoice` | The money record. A period of one person's time, an amount, and whether it was paid. |
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

**An invoice covers exactly one person's hours.** Whoever issued it
(`Invoice.user`) is the person whose time it bills for — a worker invoices the
project owner for their own hours, an owner invoices their client for theirs.
One invoice never sums several contributors together, because the resulting
record would name nobody and leave the contributors with nothing of their own.

**`Time.isPaid` is owned by `Invoice`.** `InvoiceManager.markPaid` sets it and
`markUnpaid` clears it, scoped to the issuer's own entries in the invoiced
period. Nothing else writes it except an author correcting their own entries by
hand — one at a time, or in bulk through `POST /time/paid` and `/time/unpaid`.
Those bulk paths do not update the invoice that covers the entries, so work and
money can be driven apart through them; that divergence is a known defect, not
a second owner of the flag.

This is what stops the work record and the money record from drifting.

**Only the issuer may mark an invoice paid.** The person owed the money is the
one who knows whether it arrived; letting the payer self-certify would make the
record worth less than the wallet history it summarises.

**Already-paid hours cannot be re-billed.** Invoice creation only considers
unpaid time, so the same hour cannot appear on two invoices.

**Money is integer cents.** `Invoice.amountCents`, never a float — a float
cannot represent every cent exactly, so sums drift and two clients can render
the same row differently. It becomes a decimal string only at the UI edge.

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

There is no mechanism for granting an outsider access to a single invoice. An
invoice leaves the product as a PDF, sent by the issuer.

## What premium governs

**Collaborators are free.** Adding a worker or a viewer costs nothing and is
not gated.

Premium governs **how long recorded time is kept**. On the hosted service an
unpaid workspace rotates timelogs at 14 days; paying converts the whole
workspace so nothing rotates. A self-hosted instance is unconditionally
entitled — unlimited seats, no rotation (see `service/entitlement.ts`).

Retention is a property of the workspace, never of one person: `ProjectStatistics`
and invoice reports aggregate across contributors, so a project whose
contributors had different retention would report totals that quietly disagree
with the work done.
