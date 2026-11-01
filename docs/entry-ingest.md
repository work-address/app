# Entry ingest

Status: done on 1 November 2026, by deleting the dead code and fixing the leak below. The split into its own module was reconsidered and not done: once the other two briefs shipped, `TimeManager.createOrUpdateMany` already is the one interface for an upload, and the evidence rule has to stay inside the repository's lock. Moving the method would only rename it. Reopen this if ingest grows a second caller.

Deletes dead code from `TimeRepository`, then gives the rules for accepting an upload a module of their own.

## Why

`time-repository.ts` is 833 lines with 21 public methods and four concerns:

| Concern | Where | What happens to it |
| --- | --- | --- |
| Search and totals | `findAndCount` (170 lines), `getTotals` | Stays |
| Access filter | `:811` | Leaves with [project-access.md](project-access.md) |
| Invoice eligibility | `:657,710,742` | Consolidated by [invoice-lifecycle.md](invoice-lifecycle.md) |
| Ingest | `saveWithUsage` (`:69-136`), `softDeleteExpiredEntriesForProjects` (`:515`), plus `TimeManager.createOrUpdateMany` | This brief |

**Dead code.** No caller exists outside the file for `findByIdsConfirmAccess`, `findTimeAsAuthorOrFail`, `findAllTimeForProject`, `findTimeForAuthorBetween` or `findTimeBetweenForProject`. `findWithProcessesForProjectSince` is called only by `ProjectStatisticsManager.getStatsForProject`, which has no caller outside its own file.

**Ingest is where the expensive bugs were.** `4b92de7b`: retention purged by the wrong person. `68eba1ac`: a re-upload overwrote evidence. Its rules span a manager and a repository:

- A re-upload replaces a slice, unless it's published, when evidence freezes (`saveWithUsage`).
- Retention follows the project owner's plan, is refused up front, and never purges invoice backing (`time-manager.ts:84`, `softDeleteExpiredEntriesForProjects`).
- An entry belonging to someone else is refused (`time-manager.ts:103`).

There's also one leak across the seam: `time-manager.ts:249` reaches through `getRepo().manager` to run its own transaction.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Dead code | Delete now, independently | Waiting for the split |
| Whether to split | Only if, after the other two briefs, ingest rules are still spread across the manager and repository | Splitting on principle |
| Module | `TimeIngest`, one operation: a list of uploaded items in, one result per item out | A class per rule |
| Search | Stays in `TimeRepository` | A separate search module, since nothing currently varies and it has no bug trail |
| Per-item errors | Kept exactly as they are. The desktop depends on `error.name` for each bucket (`RestApiSet.qml:674`) | Any change to names or order |
| Manual entries | Keep their own path in `TimeManager` | Forcing them through ingest, whose rules are about uploads |

## Module

`service/time-ingest.ts`, injectable.

| Interface | Owns |
| --- | --- |
| `ingest(items, user)`, returning one result per item, in order | Project eligibility, retention, ownership of the slice, evidence freeze, usage rows, screenshot resize, purge of what expired |

`TimeRepository` keeps a lock-and-save primitive, and `removeProcesses` gets a repository method in place of the `getRepo().manager` reach.

## Tests

Existing `time-manager.test.ts` and `app-statistics.test.ts` ingest cases move to `test/service/time-ingest.test.ts`, unchanged in substance. Add:

- A retry after publishing with changed minutes is refused, and with identical data keeps evidence.
- A free-tier worker on a premium owner's project purges nothing.
- A mixed batch returns per-item errors in order.

Controller tests stay. They prove the route contract the desktop relies on.

## Steps

1. Delete the five finders, `getStatsForProject` and `findWithProcessesForProjectSince`. Delete `ProjectStatisticsManager` if nothing else is left in it. Fix the `getRepo().manager` reach.
2. Stop here until [project-access.md](project-access.md) and [invoice-lifecycle.md](invoice-lifecycle.md) ship, then reread the file.
3. Add `TimeIngest`, moving `createOrUpdateMany` and the rules with their tests.
4. Reduce `saveWithUsage` to its lock-and-save primitive.

## Behaviour that changes

None. What the desktop receives must stay byte-for-byte the same.
