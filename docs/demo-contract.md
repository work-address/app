# Demo contract

Status: done on 1 November 2026, on `feat/0-demo-mode`. Window titles and gaps stay empty in the mock, because its seed has no data to draw them from, and no scenario depends on them. `api-contract.yml` has not run yet.

One suite of scenarios runs against both the real API and the demo's mock, so a disagreement fails a test. The statistics rules that can be pure move into `packages/statistics-core`.

Related documents: [demo-mode.md](demo-mode.md) promises the mock "applies the API's scope, visibility and review-window rules"; [`SPEC.md`](../SPEC.md) "Who can see what" is the reference.

## Why

`mock/statistics.ts` says the two "cannot drift", which holds only for focus, hours and assisted time. `mock/statistics.test.ts` tests only the mock, `test/service/app-statistics.test.ts` tests only the API, and `mock/handlers.ts` (783 lines) has no test file.

Differences found by reading, each with the expected answer:

| Behaviour | Mock | API | Fix |
| --- | --- | --- | --- |
| Marking an invoice paid (`handlers.ts:335,701`) | Project owner | Issuer | Issuer. A worker-issuer in the demo currently gets a 403 on a button the UI shows them |
| Editing an entry (`handlers.ts:317`) | Owner or author | Author | Author |
| Issuing an invoice (`handlers.ts:656`) | No unpaid filter, no period | Both | As API |
| Searching entries (`handlers.ts:228`) | No active-project filter | Filtered (`time-repository.ts:274`) | As API |
| Project stats for a viewer (`handlers.ts:524`) | Excluded | Included once published | As API, after checking against `SPEC.md` |
| Run invoice filter (`statistics.ts:342`) | Missing | `statistics-repository.ts:229` | As API |
| Invoice ownership check (`statistics.ts` scope) | Missing | `statistics-manager.ts:63` | Shared rule |
| Gaps and titles (`statistics.ts:278,256`) | Empty | Real | Add |
| Day keys (`statistics.ts:63,167`) | Browser's midnight | `query.timeZone` | Use the query's zone, via `zoned` |
| Minutes (`shape.ts:144`, `handlers.ts:676`, `db.ts:651`) | `entries.length * 10` | Each entry's span | Each entry's span |

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Which is right | The API, unless `SPEC.md` says otherwise. Then the API is the bug | Treating the two as equals |
| What gets shared as code | Statistics scope resolution and report permissions, in `statistics-core` | Importing API modules into the browser bundle; a shared policy package, since membership is small enough to pin through scenarios |
| SQL aggregation | Stays in the repository for performance, verified by scenario | Sharing it, which would mean aggregating in memory |
| Scenarios | Permissions and shapes first: status code, which fields are present, which rows appear | Exact figures across worlds, which would pin the mock's seed data |
| Where they live | New workspace package `packages/api-contract`, framework-free, with one runner each for Mocha and Vitest | Choosing one test runner for both |
| Coverage | Routes the UI's role-dependent behaviour relies on, not all routes | Generating the mock from `openapi.json`, which gives shapes but none of the rules |

## Module

**In `statistics-core`:**

| Rule | Today |
| --- | --- |
| Validate the range and resolve its bounds in a time zone | `statistics-manager.ts:30`, `statistics.ts:68` |
| Which of the visible projects a query covers, and when to refuse | `statistics-manager.ts:56-84,90`, `statistics.ts:82-112` |
| Whether a role may read a report, and what gets stripped for a viewer | `statistics-manager.ts:103-125`, `statistics.ts` |

Both callers pass in projects already labelled with the reader's role, and the API gets that from `ProjectAccess.role`.

**In `packages/api-contract`:**

- `Scenario`: given a world, as a person, this request gets this status and these properties.
- `ContractAdapter`, with two adapters:
  - **API:** real Postgres and real HTTP, in `api/src/test/contract/`, seeded with existing fixtures.
  - **Mock:** `msw/node` and `fetch`, in `web/src/shared/mock/contract.test.ts`, seeded through `db.ts`.
- The world is small and named: an owner, a worker, a viewer, an outsider, a project, published and unpublished entries, an invoice issued by the worker.

## Scenarios

Start from the `SPEC.md` table, one row per cell, then add each row of the differences table above. Also cover: role × entry detail before and after the review window; role × invoice read, pay and reject; role × each statistics report; a closed project in search.

Delete mock tests that only restate these. Keep `db.test.ts` and the insights tests, which cover the seed and pure calculation.

`.github` holds only `agent-tracker.yml`, so no workflow runs these suites today. Add one that runs the contract suite for both adapters. Without it, drift goes unnoticed until someone runs tests by hand.

## Steps

1. Add the package, the adapters and a first scenario, passing on both.
2. Add scenarios for the differences table. Expect mock failures, and keep them skipped with a reason until step 3.
3. Fix the mock, one row at a time, removing the skips.
4. Move scope and report permissions to `statistics-core`, used by both.
5. Add the remaining `SPEC.md` scenarios and the workflow.
6. Correct the `cannot drift` comment and link `demo-mode.md` here.

## Behaviour that changes

Only the demo: it matches the API for every row above, so some demo roles lose buttons they could press and worker-issuers gain ones that work. The API doesn't change, except where a scenario exposes a real API bug. Fix those separately, against `SPEC.md`.
