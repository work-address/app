# Domain specification

This file governs the **domain model** only. The product description — features,
users, pricing, phases and the discrepancy register — is `PRODUCT.md` in the
`work-address/web` repository.

Work Address has **five core domains and no others**:

| Domain | What it owns |
| --- | --- |
| `User` | Identity. A wallet address, a profile, roles, the premium flag, and the agents this person runs. |
| `Project` | A body of work, its hourly rate, and who may touch it — `workerAddresses` / `viewerAddresses`, resolved to `workers: User[]` / `viewers: User[]` — plus the agents its workers have attached, each with its own rate. |
| `Time` | The work record, in two tables: human entries with activity data (`time`) and agent runs (`time_agent`). Both carry `isPaid`. |
| `Invoice` | The money record. A period of one person's work — their own hours and their agents' runs, a line each — an amount, and whether it was paid or rejected. |
| `Statistics` | What time was spent on. Normalized breakdowns of `Time` records — app usage per human entry, tool usage per agent run — and every report aggregated from them. |

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
  `Statistics` already covers reporting. Deleted.
- **Agents as users** were proposed: an AI agent with its own wallet, its own
  login and its own invoices. An agent is a tool its worker runs. It is an entry
  on that worker's `User`, attached on `Project`, and its runs are `Time`.
  Not a user.

Each of these looked reasonable in isolation. Together they duplicated
`Invoice` and `Project`, split the meaning of `Time.isPaid` across two owners,
and produced two records of the same economic event that could disagree.

Before adding a sixth domain, write down which of the five cannot hold the
data and why. If the answer is "it would be tidier", the answer is no.

## Time and Invoice are the truth points

Everything about work done and money owed resolves to these two:

- **`Time` is the only record of work.** Nothing else stores hours. It keeps
  human entries and agent runs in separate tables because they have different
  shapes — a keystroke slice is not a run with prompts, tokens and wait states —
  not because they are different kinds of record.
- **`Invoice` is the only record of money.** Nothing else stores an amount
  owed, and nothing else decides whether an hour has been paid for.

**Human and agent hours are never added together.** Parallel agents can log
more hours than the wall clock holds, so a combined figure would describe no one's
work. The money they earn is money, and does add up.

### The rules that keep them consistent

**An invoice covers exactly one person's work.** Whoever issued it
(`Invoice.user`) is the person whose time it bills for — a worker invoices the
project owner for their own hours, an owner invoices their client for theirs.
Their own hours are one line; each agent they run is a line of its own, at that
agent's rate. The lines are frozen when the invoice is created, like its amount.
One invoice never sums several contributors together, because the resulting
record would name nobody and leave the contributors with nothing of their own.

**`Time.isPaid` is owned by `Invoice`, in both tables.** `InvoiceManager.markPaid`
sets it and `markUnpaid` clears it, scoped to the issuer's own entries and runs
on the invoice. Nothing else writes it except an author correcting their own
human entries by hand — one at a time, or in bulk through `POST /time/paid` and
`/time/unpaid`. Those bulk paths do not update the invoice that covers the
entries, so work and money can be driven apart through them; that divergence is
a known defect, not a second owner of the flag. Agent runs have no hand-edit
path.

This is what stops the work record and the money record from drifting.

**Only the issuer may mark an invoice paid.** The person owed the money is the
one who knows whether it arrived; letting the payer self-certify would make the
record worth less than the wallet history it summarises.

**Only the owner may reject an invoice.** The person paying is the one who
disputes. Only a requested invoice can be rejected, and only as a whole.
Rejection keeps the invoice as a record, releases its entries and runs, and
leaves the issuer to issue a corrected one; a rejected invoice covers nothing.
It is the owner's protection against wrong hours or a wrong agent rate, which
is why the owner needs no edit rights over a worker's agents.

**Already-paid hours cannot be re-billed.** Invoice creation only considers
unpaid, uninvoiced time, so the same hour cannot appear on two invoices. Only
finished agent runs are invoiceable, and an invoiced run is frozen: late data
for it is set aside, never applied, so the run cannot drift from the invoice
that bills it.

**Money is integer cents.** `Invoice.amountCents`, never a float — a float
cannot represent every cent exactly, so sums drift and two clients can render
the same row differently. It becomes a decimal string only at the UI edge.
Invoice lines and agent rates are integer cents for the same reason.

**Retention never destroys an invoice's evidence.** The free-tier purge skips
entries and runs covered by an invoice from the same issuer, so a financial
record always keeps the detail behind it, usage rows included. A rejected
invoice is not evidence: what it released rotates like anything else.

## Statistics explains time; it never records it

`Statistics` holds breakdowns of `Time` records: how a human entry's active
minutes divide among apps, window titles and browser domains, and which tools
an agent run used. A breakdown of a record lives in `Statistics`; the record's
own fields — an entry's minutes, a run's tokens and timings — stay on the
record.

**A breakdown never adds time.** An entry's usage rows never add up to more
than that entry's active time. A run's tool durations can overlap, because an
agent can call tools in parallel, so they are shown per tool and as counts and
never summed into a time total.

**Invoices never read `Statistics`.** It is evidence of what billed time went
into, not a second ledger of it. Usage rows are deleted along with their entry
or run, so a report can never show detail for time that no longer exists.

**Missing detail looks missing.** Every entry says whether its app detail was
recorded and, if not, why — a setting, a missing permission, an unsupported
desktop, an older desktop app. Reports show those minutes as gaps, never as
idle time.

Reports are computed on read, from these rows and from `Time`, for any date
range in the viewer's timezone, and for exactly the entries an invoice covers.
Nothing is cached, so nothing goes stale. The plan is in
`docs/app-statistics.md`.

## A worker's agents are the worker's

A worker keeps a list of agents, one per product they run — Claude Code, Codex,
and so on. They attach their own agents to projects they work on and set each
agent's hourly rate for that project, from zero. The owner sees every agent,
rate, run and prompt on the project but cannot add, change or remove any of
them; the owner's levers are rejecting an invoice and removing the worker.

**An agent's billing rights never exceed its worker's.** A worker who detaches
an agent can still invoice its past runs at its last rate. A worker the owner
removes can no longer invoice, and neither can their agents.

**Agents hold no access of their own.** An agent cannot sign in. Runs arrive
through a write-only credential the worker issues for each machine, which opens
no other route.

The build order and the measurement rules are in `docs/agent-time-tracking.md`.

## Who can see what

| | Project time | App statistics | Window titles and domains | Agents: runs, prompts, rates | Own invoices | Others' invoices |
| --- | --- | --- | --- | --- | --- | --- |
| Project owner | yes | **every worker, per worker** | **all workers'** | **all workers'** | yes | yes |
| Project worker | yes | **own only** | **own only** | **own only** | yes | **no** |
| Project viewer | yes | **project totals by app name** | **no** | **no** | **no** | **no** |

A worker sees their own invoices only: one contractor's rate and hours are not
another contractor's business.

**A worker sees only their own app statistics, titles and domains.** Window
titles and browser domains say far more about how someone works than an app
name does. Inside time entries they are visible only to the owner and the
entry's author; screenshots and app names in entries keep the project-wide
visibility above.

**A worker sees only their own agents.** The same reason covers agents, and
more: an agent's prompts describe how a contractor works, not only what they
charge. Project-wide agent totals are the owner's alone.

**A viewer sees no invoices, no agents, and no app detail beyond project-wide
totals by app name.** The role exists to watch progress, not money. The rate-privacy reason given above for workers applies to
a viewer more strongly, not less: a viewer added to a project with several
contributors would otherwise read every contributor's rate, and a viewer is
typically further from those contributors than a fellow worker is.

There is no mechanism for granting an outsider access to a single invoice. An
invoice leaves the product as a PDF, sent by the issuer.

## What premium governs

**Collaborators are free.** Adding a worker or a viewer costs nothing and is
not gated. Attaching an agent is not adding a collaborator: it rides on the
worker's own membership.

Premium governs **how long recorded time is kept**. On the hosted service an
unpaid workspace rotates timelogs and agent runs at 14 days; paying converts the
whole workspace so nothing rotates. A self-hosted instance is unconditionally
entitled — unlimited seats, no rotation (see `service/entitlement.ts`).

Retention is a property of the workspace, never of one person: `Statistics`
and invoice reports aggregate across contributors, so a project whose
contributors had different retention would report totals that quietly disagree
with the work done.
