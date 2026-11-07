# Time: finish one presentation slice at a time

Preview: [time.html](../previews/time.html). App route: `/time`.
Read the [handoff](../../../claude-handoff-time-workspace.md) before selecting a unit.

## Current starting point

The working tree already uses `WorkspacePage`, `WorkspacePageHeader`, and
`WorkspacePanel`. `TimeWorklogs` owns persistent filters, the sort/view controls,
selection, and the entry dialog. The phone List view now uses `TimeTableStack`.
Inspect the diff and finish the existing work; the old handoff's unimplemented
Time baseline is obsolete.

## Units

| Unit | Files under `web/src/` | Finish condition |
| --- | --- | --- |
| T1 — composition and filters (default next unit) | `pages/time.tsx`, `features/time/ui/time-worklogs/time-worklogs.tsx`, `features/time/ui/time-filters/` | Header, persistent filter panel, sort, and List/Grid controls use shared geometry and remain usable in loading, error, and zero-result states; every existing filter remains accessible. |
| T2 — list and grid | `features/time/ui/time-table/`, `time-grid/`, `common/time-day-heading.tsx` | Flat readable rows/day groups; deliberate screenshot and missing-media treatment; phone rows retain all authorized facts; selection and paging work in both views. |
| T3 — entry details and bulk actions | `features/time/ui/time-dialog/`, `time-worklogs/time-worklogs-bulk-actions.tsx`, `common/time-mobile-bulk-actions.tsx` | Dialog/drawer styling matches the page, with navigation, notes, payment, screenshot/process/agent information and bulk actions intact. |

Paths after the first directory in a row remain under `features/time/ui/`.
If a unit already meets its finish condition, record evidence and select the next
Time unit. Complete Time's final review before moving to another page.

## Preserve these contracts

- `$allTime` contains loaded pages; `$timeEntriesTotal` is the server count.
  Day totals derive from the loaded entries in that group. The preview's complete
  weekly summary/day selector is an optional later feature, not a value to derive
  from a partially loaded feed or a reason to hide older entries.
- Desktop filters auto-apply. Mobile fields remain drafts until Apply.
  Preserve project/date/note/activity/keyboard/mouse/distance filters and
  `useTimeSearchSync` URL/reload behavior.
- Header sorting and the sort picker share their model. List day headings follow
  the current date-sort rule; Grid retains grouping. Keep the persisted view key.
- Selection spans List/Grid, respects the same-project invoice rule, and retains
  pending/clear/select-all behavior. Inspect `model/time-select-all.ts` and its
  new test before changing selection; they are pre-existing work in this checkout.
- Preserve first-load skeletons, infinite loading, and pagination failure
  semantics. Keep filters available when no rows match.
- Keep the dialog's previous/next rules, dirty-form navigation behavior,
  close/Escape behavior, and actual mutation handling. A payment badge in the
  live app changes data; concept clicks are not a model for production semantics.
- Preserve role-dependent agent visibility and prompt redaction in details.

## Focused verification

Apply the handoff's shared visual checks, then exercise both views, table-header
and picker sorting, a custom date range, each filter family, mobile Apply,
selection/clear, entry navigation, and loading another page.

Relevant existing checks are in `features/time/model/time-grid.test.ts`,
`time-sort.test.ts`, `time-url.test.ts`, `time-bulk*.test.ts`,
`time-select-all.test.ts`, `features/time/ui/time-dialog/time-dialog-agents.test.ts`,
and `entities/time/time.queries.test.ts`. Run those covering changed behavior;
do not add tests that only restate CSS values.

Deliver a List and Grid screenshot, a phone screenshot, the completed unit ID,
and remaining Time gaps. Do not call the whole Time page finished after only T1.
