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
| `Invoice` | The money record. A period of one person's time - or one agreed sum for a named piece of work - an amount, the financial snapshot the amount was computed from, and whether it was paid. |
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
(`TimeBounds`): `fromAt` before `toAt` and at most 60 minutes apart, `fromAt`
at most 5 minutes past the server's clock, `minutesActive` from 0 to the
minutes from `fromAt` to whichever comes first, `toAt` or 5 minutes past the
server's clock (rounded up), and no negative activity counter. A row that
breaks a rule is refused in its own slot of the batch, naming the field and
the rule, and the rest of the batch is stored.

The future bound is on what a row claims, not on `toAt`. The desktop tracker
sends its ten-minute bucket with `toAt` at the bucket's planned end, and it
uploads the bucket still in progress (on Stop, at start-up, on a token
refresh), so a normal upload's `toAt` is up to ten minutes ahead. The
tracker treats a refusal as final and never sends those rows again, so a
bound on `toAt` would lose that work. This departs from the literal wording
of REC-09 ("`toAt` at most 5 minutes in the future"); DEC-10, which the rule
belongs to, is still open, and the values are the development plan's.

A timestamp with no zone is UTC. The desktop tracker sends `fromAt` and
`toAt` as ISO-8601 text in UTC without an offset (`2026-01-27T12:10:00`), so
`POST /time` reads them as UTC whatever zone the server runs in; one that
names its offset or `Z` keeps it.

**An invoice covers exactly one person's hours.** Whoever issued it
(`Invoice.user`) is the person whose time it bills for — a worker invoices the
project owner for their own hours, an owner invoices their client for theirs.
One invoice never sums several contributors together, because the resulting
record would name nobody and leave the contributors with nothing of their own.

**An invoice bills hours or an agreed sum, never both (`Invoice.basis`).**
`HOURLY` - every invoice issued before the basis existed, which the column
default makes them - bills tracked entries at the rate, as the rest of this
section describes. `FIXED` bills a sum both sides agreed for a named piece of
work: a marketplace milestone, raised only by the marketplace's signed
internal call `POST /api/internal/marketplace/milestone-invoice` (HMAC over
the body, a replay window and a one-time nonce, under its own header
`X-Marketplace-Milestone-Signature`, left out of the public spec). It has
**no `Time` behind it**: fabricating entries that add up to the sum would put
hours nobody worked into the only record of work. So a fixed invoice carries
no lines, zero minutes and a stored rate of zero, reports no rate at all
rather than one divided out of minutes it does not have, and says in
`description` what it bills for; `milestoneRef` names the milestone and is
unique, so a push retried or raced bills once and answers with the first
invoice. It is issued by the hired worker on the contract's project, never by
the client who pays it, and is otherwise an ordinary invoice: the same
snapshot rules, the same paid and escrow paths. There is still no milestone,
deliverable or allocation entity here - the milestone's workflow is the
marketplace's, and what it becomes here is one `Invoice` row.

**`Time.isPaid` is owned by `Invoice`.** `InvoiceManager.markPaid` sets it and
`markUnpaid` clears it, on exactly the entries linked to that invoice; for an
invoice submitted to escrow, a confirmed release sets it instead (see below). An
author may also set it by hand — one entry in the time dialog
(`PUT /time/:id`), or in bulk through `POST /time/paid` and `/time/unpaid` —
but only on entries no invoice covers. A request that would change it on an
invoiced entry is refused whole with a 409 naming the invoice, and the worklog
table, dialog and bulk actions disable the control for such entries and say
why: the payment is changed on the invoice.

This is what stops the work record and the money record from drifting.

**Only the issuer may mark an invoice paid.** The person owed the money is the
one who knows whether it arrived; letting the payer self-certify would make the
record worth less than the wallet history it summarises. An invoice submitted
to escrow is not marked by anyone: the chain's confirmed outcome settles it.

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
legacy invoice has no record. A FIXED invoice's record adds `basis`,
`milestoneRef` and `description` - a record of a sum with empty lines would
otherwise commit to a number rather than to a bill. The hourly record never
carries those keys, so no published vector moved.

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

**Submitting an invoice to escrow binds it to one allocation.**
`GET /invoice/:id/escrow-submission?chainId=&escrow=&allocationId=&workStart=&workEnd=`
gives the issuer — nobody else, the paying owner included (403) — what they
hand `MarketplaceEscrow`: `amountBaseUnits`, the invoice's `amountCents` in USDT
base units (6 decimals, so cents × 10^4, in integer arithmetic and as a
decimal string), and `invoiceCommitment`, the InvoiceCommitment v1 of the
invoice's record for that allocation. The first call stores the binding on
the invoice — `escrowChainId`, `escrowAddress`, `escrowAllocationId`,
`escrowCommitment`, and the salt — and every later call for the same
allocation returns exactly that, so asking twice never mints a second
commitment. The binding never moves: the chain cannot tell this service
whether a commitment it handed out was sent, so letting the invoice go to a
second allocation could bill it twice (409). An allocation takes one bill, so
it binds one invoice, enforced by a unique index over the three binding
columns (409). A legacy invoice has no record to commit to, and a paid one or
one for 0 cents has nothing to bill — MarketplaceEscrow reverts an amount of 0
(all 409). The binding is columns on `Invoice`: there
is no Allocation entity here — the allocation itself is the marketplace's
(`web/api`) and the chain's.

**Only the allocation funding the invoice's own contract binds it.** An
allocation id is public once funded (`AllocationFunded`), and a binding never
moves, so an invoice that could take any allocation could squat one and
leave the hired worker's invoice unbillable for good. The request therefore
names the allocation's work period too — `workStart` and `workEnd`, the unix
seconds of its escrow terms — and the service recomputes the id the way the
marketplace derives it (`web/api` `EscrowManager`):
`obligationId = keccak256(abi.encodePacked(string "work-address:contract-period",
string marketplaceContractId, uint64 workStart, uint64 workEnd))` and
`allocationId = keccak256(abi.encodePacked(uint256 chainId, address escrow,
bytes32 obligationId))`, with `marketplaceContractId` the invoice's project's.
It binds only when that equals the requested `allocationId`, and only an
invoice whose period lies inside `[workStart, workEnd]` (both ends included),
since an allocation pays for its own period's work; otherwise 409, as is an
invoice on a project no marketplace contract hired for. The issuer must also
be the worker hired on the project — their address among its workers, and
not its owner, who is the payer even on an invoice of their own (403). The
marketplace's submit flow (WP-25) sends the period it funded along with the
allocation.

**Salt custody (adopted default; the owner decision is still open).** The
hosted API draws a fresh random 32-byte salt for each submission, stores it
with the invoice (`Invoice.escrowSalt`, in no serialisation group, so no
invoice response carries it) and lets only the issuer export it, in their own
escrow-submission response. This protects the invoice from **chain
observers**: without the salt, the commitment on chain cannot be recomputed
from public ids or matched against a guessed record. It does **not** protect
the invoice from the **platform operator**, who holds each salt next to the
record it commits to and can open every commitment the hosted service drew.
An issuer who needs the operator unable to open their commitment has to draw
and keep the salt themselves and compute the commitment outside the hosted
service, from the exported record and the published encoding.

**An escrow-bound invoice is settled by the chain, not by hand.** Once an
invoice is bound to an allocation, `POST /invoice/:id/paid` and `/unpaid`
refuse it (409): a hand mark could call paid a bill the escrow refunded, or
unpaid one it released. The marketplace's escrow indexer (`web/api`) reports
each confirmed outcome of the allocation to
`POST /api/internal/marketplace/settlement`, a service-to-service route
authenticated exactly like the marketplace hire — HMAC with the shared secret
over the body, a replay window and a one-time nonce — under its own header
(`X-Marketplace-Settlement-Signature`), and left out of the public API spec
and both generated clients. The push names the invoice and carries the
allocation's state after the event, not the event's delta: `escrowState`
(MarketplaceEscrow's own states: `SUBMITTED`, `RELEASED`,
`DISPUTED_REFUNDED`, `EXPIRED_REFUNDED`, `CANCELLED_REFUNDED`), the bill's
gross, the fee and net release paid, everything refunded to the payer, the
settling transaction and its block time. It is accepted only for an invoice
bound to exactly that allocation whose on-chain commitment is the invoice's
own (409 otherwise), and only if the escrow's arithmetic could have produced
it — release pays gross exactly as net plus fee, a dispute refunds at least
the bill, nothing else pays out (400 otherwise). Because it is absolute, it is
idempotent: the same outcome again, or one a later push has overtaken, changes
nothing; a second final state, or the same state settled differently, is a
409.

- A **release** makes the invoice `PAID` with `paidAt` the release block's
  time, and marks every entry it bills `isPaid`, in one transaction with the
  invoice row locked — the same cascade as a hand mark, so `Time.isPaid` keeps
  one owner.
- A **dispute refund** records the refund and leaves the invoice and its
  entries unpaid. Nobody can mark it paid by hand afterwards: the payer
  disputed the bill on chain, and the record keeps saying so.
- The record is columns on `Invoice` — `settlementKind` (`MANUAL` when the
  issuer marked it, `ESCROW` once a confirmed outcome is recorded),
  `escrowState`, `escrowGrossBaseUnits`, `escrowFeeBaseUnits`,
  `escrowNetBaseUnits`, `escrowRefundedBaseUnits` (token base units, exact
  integers), `escrowTxHash` and `escrowConfirmedAt` — read by the issuer and
  the owner like the rest of the invoice. There is **no Settlement or
  Allocation entity** in this service: how an invoice was paid is part of the
  money record, and the allocation itself is the marketplace's and the
  chain's. This service never holds or moves the funds; it records what the
  chain confirmed.

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

## Who sees a profile

A profile is public unless its holder hides it. `GET /user/:address/address`
answers anyone with the `public` projection - the address and what the
profile page shows, never contact details, roles or the plan. A hidden
profile (`User.visible` false) answers that route with the same 404 as an
address with no account, to everyone but its holder, so a 404 never says that
someone is there and hiding; it also drops out of other people's
`/user/search`. People who share a project still see each other on it: hiding
a profile does not undo a collaboration.

Hiding is about the pages this service serves and nothing else. It never
touches a profile published on chain: that stays current until its holder
withdraws it there, and a withdrawal is itself on chain, where every earlier
version stays readable. The edit form says so next to the switch. The hosted
identity (`GET /user/:address/identity`, below) is hidden with the profile.

## Portable identity

A holder can anchor a profile on chain: their wallet publishes a commitment
to `IdentityRegistry` (profile schema v1, from the contracts repository), and
this service hosts the presentation that opens it, so the public profile can
show which fields are anchored. It is part of `User`, not a domain of its
own: the profile it commits to is the user's profile.

- **Where.** `GET /identity/config` (anonymous) names the chain and registry
  this instance reads (`APP_IDENTITY_*`), or `enabled: false`. The service
  only reads the chain; the holder's own wallet sends every transaction.
- **Only EVM accounts anchor.** The registry keys records by a 20-byte EVM
  address (`did:pkh:eip155`), so a TON or Solana account is refused by name
  (422) - which takes nothing away from a self-signed export made on the
  holder's device.
- **What is hosted.** `PUT /user/identity` takes an anchored presentation,
  checks it offline with `@work-address/identity` (vendored under
  `api/src/vendor/identity`, pinned to the published vectors) and then with
  the registry's own `checkPresentation`, and stores it only when its
  subject is the caller (403) and the chain holds it as the subject's
  **current** version. A superseded, withdrawn or unpublished version is
  refused (409) rather than stored as such: the hosted copy is the current
  profile. It is three columns on `User` - the presentation, its version and
  the export below - in no serialisation group, and never written by a save
  of the user. Only the current presentation is kept; the version history
  is the registry's, read from its events whenever
  `GET /user/:address/identity` shows it, with the chain's answer now
  (`result`, `subjectDeactivated`, the block checked and whether the
  finalized block agrees). A chain that cannot be read is reported as such
  (503 on publish, `status.unavailable` on read), never as a failed proof.
- **Taking it down.** `DELETE /user/identity` removes the hosted copy and
  the held export, and nothing else: the registry keeps every version the
  holder published and copies others saved remain (SC-A07). Withdrawing on
  chain is the holder's `deactivate` transaction. Hiding the profile hides
  the hosted identity from everyone but its holder too.

**Salt custody (adopted default; the owner decision is still open).** Every
field is committed with its own random salt, and who holds those salts
decides who can open the commitment. By default (`custody: hosted`) the
holder sends their private export with the presentation - every field's
value and salt - and this service keeps it, returning it to the holder alone
(`GET /user/identity/export`). This protects the profile from **chain
observers**: the commitment on chain opens nothing, and no field can be
guessed and checked against it without its salt. It does **not** protect it
from the **platform operator**, who holds every value in the `User` table and
every salt in the export, and so can open any field of the commitment. A
holder who wants the operator unable to open the fields they did not show
asks for `custody: holder`: only the presentation is stored - the salts of
the fields shown in public, which are public anyway - and the export stays on
their device. Profile schema v1 itself recommends drawing salts on the
holder's device and says a service keeping the export must state what it can
see; this is that statement.

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
