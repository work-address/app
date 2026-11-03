# Invoice lifecycle

Status: done on 1 November 2026 (`411b04b6`, `e5bdeb9c`), on `feat/0-demo-mode`. The class stayed `InvoiceManager`, with the method names `SPEC.md` uses: renaming would have moved nothing. Not checked: how many production invoiced entries already disagree with their invoice.

Hand corrections were reversed afterwards: an author may change `isPaid` by hand on an invoiced entry too, and `InvoicedTimeException` is gone. `SPEC.md` has the rule; the sections below keep the decision as it was made.

One module owns issuing, settling and rejecting an invoice: who may, what it bills, and what happens to the entries behind it. The repository locks and persists.

Related documents: [`SPEC.md`](../SPEC.md) "The rules that keep them consistent" is the rule set; `web/PRODUCT.md` §13 G4 and G8 record known gaps.

## Why

- **The amount is calculated and thrown away.** `InvoiceManager.amountFor` runs at three call sites (`:167,237,353`), then `invoice-repository.ts:207` overwrites the result. It went dead when `68eba1ac` moved line-building, and no test names it.
- **The real calculation can only run inside a transaction.** Line-building sits in the 170-line `saveWithEntries` (`:58-227`), alongside locking and persistence.
- **Minutes are computed three ways.** `amountFor` and the line's `minutes` clamp at zero, `Calc.spanMinutes` doesn't (used by `reportFor`, `:171` for manual minutes).
- **Comments promise what the code doesn't deliver.** `reportFor` says "cannot drift", and then `read` overwrites six of its nine fields.
- **`markPaid`, `markUnpaid` and `reject` are pass-throughs.** Their rules live inside repository transactions.
- **Work and money can drift (G4).** `POST /time/paid` and `/time/unpaid` and `editAndSave` change `isPaid` on invoiced entries without touching the invoice. `SPEC.md` calls this a known defect.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Lines | Pure, in `InvoiceLines`, beside `AgentInvoiceLines`. One clamped minutes rule, also used by reports | Keeping them in the transaction |
| Amount | Always the sum of the lines. `amountFor` goes | Calculating it twice and checking |
| Hand corrections (needs your call) | An author may still correct `isPaid` by hand on entries **not** on an invoice. An invoiced entry refuses with `InvoicedTimeException`, which the desktop already explains. Closes G4 | Updating the invoice from the entry, which makes a part-paid invoice a new state; leaving the defect |
| Existing drift | Report how many invoiced entries disagree with their invoice before shipping. Don't rewrite them silently | An automatic data fix |
| Report | `read` builds it from the invoice's frozen lines plus entry sums. `reportFor` stops pretending to be the source of the money figures | Keeping the overwrite |
| Authorisation | Moves from repository transactions to the lifecycle: issuer settles, owner rejects, membership from `ProjectAccess` | Leaving it in the repository |
| Locks | Stay in the repository as they are, and the rule checks run inside the same transaction | Checking before locking, which opens a race |
| Status of a rejected invoice | Unchanged: terminal, entries released, frozen lines kept | Any change |

## Module

`service/invoice-lifecycle.ts`, injectable. It replaces `InvoiceManager`.

| Interface | Rule it owns |
| --- | --- |
| `issueForPeriod(project, author, from, to)` | Entries unpaid and not invoiced; agent runs in the period |
| `issueForEntries(project, author, entries)` | The selection must all be the author's, unpaid and not invoiced |
| `ensureForProject(project, author)` | Idempotent: bills what is outstanding, or returns the latest |
| `settle(invoice, actor)`, `unsettle(invoice, actor)` | Issuer only; a rejected invoice can't be paid; entries and runs follow |
| `reject(invoice, actor, reason)` | Owner only; requested only; whole invoice; entries and runs released |
| `read(invoice, user)` | The invoice, its entries and report |

`InvoiceRepository` keeps `lockForIssue`, `lockForPayment`, `save` and searches. The eligibility predicate repeated at `time-repository.ts:657,710,742` and `invoice-repository.ts:96` becomes one private query in the repository, taken by those finders.

## Tests

- **In-process:** new `test/service/invoice-lines.test.ts` for rounding once at the end, a clamped negative span, manual minutes, a zero rate and mixed intervals.
- **Real Postgres, at the module's interface:** the existing `invoice-payment`, `invoice-ensure`, `invoice-selection` and `invoice-snapshot` tests move over with renamed calls. These are behaviour tests and most should survive unchanged, which is the check that this is a refactor.
- **New:** an invoiced entry refuses a hand change through `/time/paid`, `/time/unpaid` and edit, and an uninvoiced one still accepts. A worker-issued invoice settles for the issuer only.
- `invoice-controller.*` tests stay.

## Steps

1. Add `InvoiceLines` with tests. The repository calls it.
2. Delete `amountFor`, its three call sites, and the unused amount on the incoming invoice.
3. Add the lifecycle module, delegating to the current methods. Move the controller over.
4. Move authorisation in, and reduce the repository to lock and persist.
5. Move the report to the frozen lines. Remove the stale comments.
6. Count existing drift, then add the refusal for invoiced entries. Update `SPEC.md` and mark G4 resolved.

## Behaviour that changes

- Hand-marking an invoiced entry paid or unpaid is refused (step 6), and the web's toggle in `time-table-cell.tsx:113` and bulk action need to show that reason.
- A negative span counts as zero in reports, as it already does on invoices.

Invoice amounts don't change.
