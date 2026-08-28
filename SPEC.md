# Domain specification

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
period. Nothing else writes it except a user correcting a single entry by hand.
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

| | Own invoices | Others' invoices on the project |
| --- | --- | --- |
| Issuer | yes | no |
| Project owner | yes | yes |
| Project viewer | yes | yes |
| Project worker | yes | **no** |

A worker sees their own invoices only: one contractor's rate and hours are not
another contractor's business. Collaborator access of any kind requires the
project owner to hold premium; a self-hosted instance is unconditionally
entitled (see `service/entitlement.ts`).
