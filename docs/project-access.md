# Project access

Status: done on 1 November 2026 (`85adea3e`), on `feat/0-demo-mode`. Since then [google-sign-in.md](google-sign-in.md) removed TON and Solana, renamed `WalletAddress` to `AccountAddress` and added emails, so the TON and Solana parts below are history. Not checked: how many production collaborator addresses are stored in TON friendly form, which `canonicalSql` will not match. Check that, and backfill with `toStorage` if any exist.

Since then `filterEntries` follows the role: an owner lists everyone's entries, a worker their own, a viewer none. It still reads no plan, so a lapsed owner's worker keeps their own entries. The rule table is `SPEC.md`; the sections below keep the design as it was made.

One module answers who may do what to a project and its entries, as a query filter and as a per-row check. Today six copies answer it, and they disagree.

Related documents: [`SPEC.md`](../SPEC.md) "Who can see what" is the rule table; `web/PRODUCT.md` §7 #2 and §13 G11, G17 record the known gaps; [invoice-lifecycle.md](invoice-lifecycle.md) and [demo-contract.md](demo-contract.md) build on this module.

## Why

| Copy | Form | Owner's plan |
| --- | --- | --- |
| `ProjectRepository.applyViewAccessFilter` (`:307`) | SQL | checked |
| `ProjectRepository.applyWorkerAccessFilter` (`:347`) | SQL | checked |
| `TimeRepository.applyViewAccessFilter` (`:811`) | SQL | never checked |
| `AgentRepository` (`:773`) | SQL, then `isWorker` | checked in the second step |
| `Project.isWorker` / `isViewer` (`entity/project.ts:187`) | per row | only if the caller passes it |
| `InvoiceManager.assertCanInvoice` (`:275`) | per row | stored flag (G11) |

"Published" has four forms as well: `TimeVisibility.detailSql`, `statistics-repository.ts:89`, `TimeVisibility.published`, `AgentRepository.holdPrompt`.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Plan gate (*provisional*) | Keep today's behaviour. The gate is one named rule; entry reads stay ungated, on purpose and tested | Removing it now, which takes away what the flat $9.99 buys before per-seat billing exists; gating entry reads too, which moves away from the decided target and hides workers' own entries |
| Scope (*provisional*) | Membership and entry detail | Invoice rules ([invoice-lifecycle.md](invoice-lifecycle.md)); statistics report permissions ([demo-contract.md](demo-contract.md)). Both call this module for membership |
| Known bugs (*provisional*) | Fix G11 and G17 here | Keeping them, which would write known bugs into the test matrix |
| Entity methods (*provisional*) | `isWorker`, `isViewer`, `hasCollaborator` leave `Project`. `isOwner` stays: it needs no entitlement | Leaving them as pass-throughs, which callers can still bypass |
| Role and access | Two separate questions: what the address lists say, and what that grants today | One method with a flag. `statistics-manager.ts` passes `true` five times because it asks about role |
| Address rule | `WalletAddress` owns the canonical rule in both TypeScript and SQL | A second normalised column, which needs a migration and keeps two values in step |
| Tests | One matrix at the module's interface, real Postgres | Mocked query builders |

## Module

`service/project-access.ts`, injectable, bound in `app/app-container.ts` as `ProjectAccess`. It depends on `Entitlement`.

| Question | Interface | Replaces |
| --- | --- | --- |
| What the lists say | `role(project, user)` returns `owner`, `worker`, `viewer` or `null` | `isWorker(user, true)` in `statistics-manager.ts` |
| What that grants today | `access(project, user)` returns the same, with the plan gate applied | `isWorker(user, entitlement.isPremium(...))` in `project-repository.ts:244,256`, `agent-repository.ts:205,790`, `invoice-repository.ts:78`, and `assertCanInvoice` |
| Which projects | `filterProjects(qb, aliases, user, atLeast)`, gated | Both `ProjectRepository` filters and the `AgentRepository` query |
| Which entries | `filterEntries(qb, aliases, user)`, not gated | `TimeRepository.applyViewAccessFilter` |
| Is an entry published | `published(time)`, `publishedSql(alias)` | Four forms above |
| May this person see detail | `canSeeDetail(time, user)`, `detailSql(aliases)` | `TimeVisibility.detail`, `detailSql` |
| Strip what they may not see | `redact(time, user)` | `TimeVisibility.redact` |

`aliases` names the project and owner aliases, because callers use `project`/`owner`, `project`/`user` and `p`/`owner`. `Project.accessParams` becomes private to the module. `invoice-repository.ts:42` uses only the user id, and it moves to `user.id`.

`WalletAddress` gains `canonicalSql(column)`: `lower()` for EVM and TON raw addresses, the value unchanged for everything else. The private `TON` and `EVM` patterns stay the single source of what counts as which chain.

## Rules to get right

- **The gate's single home:** `access` and `filterProjects` both read one private rule, so removing it later is one deletion.
- **Self-hosted:** `Entitlement.shouldFilterByPremium()` stays the only test. Never write entitlement into the table.
- **Null review window:** `detailSql` lacks the `COALESCE` that `statistics-repository.ts:89` and `published` apply. The module uses `COALESCE(..., 24)` everywhere. This changes behaviour for any project whose window is null.
- **`time.invoice`:** `published` reads a relation `findAndCount` never joins, and it works only because invoicing also sets `publishedAt`. Add a read-only `invoiceId` column to `Time`, as `TimeAgent` has, and read that.
- **Agent prompts:** `holdPrompt` keeps its own "own run" shortcut and calls `published` for the rest.

## Tests

New `test/service/project-access.test.ts` on `AbstractDatabaseIntegration`, as a matrix:

- Role: owner, worker, viewer, outsider.
- Owner's plan: premium, lapsed.
- Mode: SaaS, self-hosted.
- Address: TON raw, TON friendly, EVM checksum case, Solana mixed case.

Every row asserts that `access` and `filterProjects` agree, and that `role` and `filterEntries` agree. Separate cases cover detail: author, owner before and after the window, published, invoiced, viewer, null window.

Delete `project.isViewer` and `isWorker` assertions in `test/service/project-manager.test.ts:317,321` and the address cases in `collaborator-address-format.test.ts` that the matrix now covers. Controller tests stay: they prove the wiring.

## Steps

Each step ships alone and leaves the suite green.

1. **Check production first:** count `workerAddresses` and `viewerAddresses` entries in TON friendly form. `089cc587` canonicalises on the way in but shows no backfill, and `canonicalSql` will not match those rows. Backfill with `toStorage` if any exist.
2. Add `canonicalSql`, the module and the matrix, using the Solana and G11 rows as the failing tests.
3. Move `ProjectRepository` onto the module and delete both private filters.
4. Move `TimeRepository` and `AgentRepository`.
5. Move the remaining per-row callers, then delete the three methods from `Project`. This closes G11.
6. Move `TimeVisibility` in, add `Time.invoiceId`, and replace `statistics-repository.ts:89` and `holdPrompt`'s window.
7. Mark G11 and G17 resolved in `web/PRODUCT.md` §13.

## Behaviour that changes

- A mixed-case Solana collaborator gains the access they were granted (G17).
- A self-hosted collaborator can invoice (G11).
- A null review window means 24 hours in entry reads, as it already does in statistics.

Everything else must be unchanged, including a lapsed owner's collaborators still reading entries.

## Follow-up, not this work

Done with per-seat billing (§7 #2 and #3): reads no longer depend on the owner's plan. The grant check (`Plan.checkGrant`) enforces the free plan's two workers, and tracking on a project whose owner has no plan goes through `Plan.mayTrack`.
