# Dashboard rework

Status: confirmed specification from design reviews on 24 October 2026, implemented on `feat/0-dashboard-split` (phases D1–D5). Baseline: this repository at `ede090f5`.

The dashboard becomes the place for statistics: time tracked, charts, app usage, personal performance insights and agent insights, for owners, workers and people tracking their own time. The worklogs move to their own page, `/time`.

Related documents: [productivity.md](productivity.md) holds the product contract (no scores or rankings, the review window, worker privacy), and this plan moves two of its Later items forward; [app-statistics.md](app-statistics.md) defines the `Statistics` domain, its routes, visibility, the shared charts and the range picker this plan reuses; [agent-time-tracking.md](agent-time-tracking.md) defines agent runs, assisted and autonomous time, and prompts.

## Product contract

- One dashboard serves every role. What each person sees follows the [visibility table](#visibility); the server enforces it on every response.
- Performance insights describe the signed-in user only. Owners never see another person's focus sessions, productive hours or input intensity.
- No single score and no ranking anywhere, as in productivity.md. The team list is sorted by name and cannot be sorted by a metric.
- Agent time is shown as **assisted** (it ran while the same worker's own timer ran on the project) and **autonomous** (the rest), never added to human time. `human_wait` never counts as agent time.
- Detail (screenshots, apps, titles, prompts) about another worker reaches the owner only after that worker publishes it or the project's review window passes.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Worklogs | Move to `/time`, unchanged, with filters and sort in the URL; the feed scrolls, so no page number | Staying on the dashboard; a worklogs redesign |
| Projects table | Stays on the dashboard, totals for the selected period | Its own `/projects` page; moving it to `/time` |
| Navigation | Dashboard → Time (clock icon) → Invoices → Profile, desktop and mobile | — |
| Audience | One view for owners, workers and self-trackers, filtered by project and person | Separate owner and worker modes; own work only |
| Period | One shared range picker, also used by the project dialog; default This week | A dashboard-only picker; a period per widget |
| Previous period | Same elapsed length (Mon–Wed against Mon–Wed) | The full previous period |
| Week start | From the locale (date-fns) | Always Monday |
| Filters across pages | Same URL parameters on both pages; each page keeps its own state | Filters carried over through the nav |
| Heatmap and focus sessions | In v1, moved forward from productivity.md's Later list | Left for later |
| Performance insights | Fixed computed metrics, self only | LLM-written narrative; per-worker insights for owners |
| Team list | Owners only; sorted by name; no metric sorting, no best/worst highlight | Sortable columns; time only |
| Agent vocabulary | Assisted and autonomous, as in app-statistics | "Leverage" and "unattended" |
| Prompts | Author and project owner; the owner after the review window | No hold; viewers too |
| Viewers | Project-level figures only | Everything on the dashboard |
| Money | Earned and Unpaid tiles; Paid dropped | Paid and Unpaid as today |
| All projects | Omitted `projectIds` means every project visible to the caller | Raising the 100 cap; chunking on the client |
| Aggregation | Server-side routes in the `Statistics` domain | Computing from paginated raw entries in the browser |
| Premium | Nothing gated in v1; the banner stays | Gating agent insights or the heatmap |
| Tokens and cost | Out of v1; come with the agent plan's token capture | A placeholder tokens series |

## Pages and navigation

- **`/time`:** the existing `TimeWorklogs` with its filters, bulk actions and time dialog. Filters and sort live in the URL, following each applied search; the feed scrolls, so no page number. Malformed values are dropped. An empty account sees the existing `TimeEmptyState`.
- **Dashboard (`/`):** the filter bar and the widgets below. A new account with no projects still sees the intro screen.
- The invoices page's "Go to your projects" button keeps pointing at the dashboard.

## Filter bar

Shown on the dashboard. `/time` keeps the worklogs' own date and project filters under the same URL names, so dashboard links land on the same entries; a people filter there waits for time search by person.

- **Range picker:** Today, This week, Last week, This month, Last month, This year, Custom; at most 366 days; days in the viewer's timezone. The same component as the project dialog's picker.
- **Projects:** multi-select, all by default. "All" sends no `projectIds`.
- **People:** multi-select, owners only, mapped to `userIds`. A worker's `userIds` is forced to themselves by the server.
- **URL parameters:** `from`, `to`, `projects`, `people`. A widget's "see these entries" link opens `/time` with them.

## Dashboard widgets

Top to bottom. Each loads, fails and retries on its own, with a skeleton while loading.

1. **KPI row:**
   - Tracked
   - Active %
   - Earned: tracked human time in the period at each project's rate (agent amounts need per-agent attachment rates and come with the invoice-line work)
   - Unpaid: the part of Earned not on a paid invoice
   - Agent time: assisted and autonomous as two figures in one tile

   Each tile shows the change against the previous period of the same elapsed length.
2. **Time per day:** bars stacked by project, by the hour for a period of one or two days (trimmed to 8:00-19:00, widened to any hour with time), by day up to about six weeks, then by week and month. `time/daily` and `agents/daily` take `bucket: 'hour'` for this. The period's seven busiest projects get a colour each, in creation order, and the rest share "Other"; a project keeps its colour within a view, though not necessarily across periods.
3. **Projects table:** the existing table, totals for the period.
4. **App usage:** the existing card, moved onto the shared charts.
5. **Your insights** (signed-in user only; over the last four weeks whenever the period is shorter, captioned so - a day has no weekday-by-hour pattern):
   - weekday × hour heatmap, shaded by active minutes
   - most productive hours
   - focus sessions: consecutive tracked slots allowing gaps of up to one slot (10 minutes), at least 45 minutes in total; count and length (both thresholds are constants)
   - active ratio
   - keys and clicks per active hour
6. **Agent insights:**
   - runs by product
   - `running` against `human_wait` time
   - assisted and autonomous time
   - status breakdown (completed, failed, …)
   - agent hours against human hours per day
7. **Recent prompts:** the last 8, each with product, project, duration and time; clicking one opens `/time` on that day and project. A held prompt says so.
8. **Recent screenshots:** the latest 8 in the period, from the newest 48 visible screenshots narrowed to the selected projects and people; clicking one opens the time dialog on the dashboard. Hidden when there are none.
9. **Team** (owners only): each worker's tracked time, active %, unpaid amount and agent time, sorted by name.

## Visibility

| Widget | Owner | Worker | Viewer |
| --- | --- | --- | --- |
| Tracked, time per day, projects table, app usage by name | Every worker | Own | Project totals |
| Active %, Earned, Unpaid | Every worker | Own | Never |
| Agent time and agent insights | Every worker's agents | Own | Never |
| Your insights | Own only | Own only | Own only, if they track |
| Recent prompts | Own; other workers' after the review window | Own | Never |
| Recent screenshots | Own; other workers' after the review window | Own | Never |
| Team | Every worker | Never | Never |
| Score or ranking | Never exists | Never exists | Never exists |

## API

Every route takes `{projectIds?, from, to, timeZone, userIds?}` under `/api`, shares the `Statistics` scope, and applies the visibility table. Omitted `projectIds` means every project visible to the caller; with a `userIds` naming anyone else, that narrows to the caller's own projects, the only ones a people filter applies to.

| Route | Returns | New |
| --- | --- | --- |
| `POST /statistics/overview` | Totals for the KPI row, with paid seconds (never for viewers); called twice for the previous period | Exists; `paidSeconds` added in D2 |
| `POST /statistics/apps/:kind` | App usage | Exists |
| `POST /statistics/time/daily` | Minutes per day per project | Yes |
| `POST /statistics/time/hourly` | The caller's active seconds per ISO weekday × hour; ignores `userIds` | Yes |
| `POST /statistics/insights/me` | The caller's focus sessions (count, minutes, longest), top 3 productive hours, active ratio, keys and clicks per active hour; measured desktop time only for ratios; ignores `userIds` | Yes |
| `POST /statistics/agents/daily` | `daily`: assisted, autonomous and wait seconds per day and product, each agent's overlapping runs merged as on invoice lines; `runs`: counts per product and status. Never viewers; no tokens yet | Planned in app-statistics |
| `POST /statistics/team` | Per person on the caller's own projects: tracked, active (after review), unpaid and agent seconds, sorted by name; 403 without an owned project | Yes |
| `POST /agent-tracking/search` | Recent runs with prompts; `projectId` optional for every project the caller works on; another worker's prompt is `null` with `promptPendingReview` until their review window passes or the run is invoiced | Changed |
| `POST /time/search` | Recent screenshots, with the existing `withScreenshots: true` filter, which already respects review and retention | Exists |

## Files

- `web/src/pages/time.tsx` and a `time` route; `web/src/pages/dashboard.tsx` reworked.
- `web/src/shared/ui/charts/` for the charts and `web/src/entities/statistics/` for queries, as app-statistics plans, so the project dialog reuses them.
- The range picker in `web/src/shared/ui/`, used by the dashboard, `/time` and the project dialog.
- Widgets in `web/src/features/dashboard/`.
- `api/src/service/statistics-manager.ts` and `api/src/repository/statistics-repository.ts` for the new routes; `api/src/repository/agent-repository.ts` for the prompt hold.
- Translations in en, es, ja, ru and zh.

Use the repository's Effector/Farfetched data flow, Feature-Sliced Design, styled-components and shared UI. No API calls from components.

## Phases

Committed in order on `feat/0-dashboard-split`, then one PR to `main` for review.

| Phase | Work | Exit condition |
| --- | --- | --- |
| D1 | `/time` page, nav item, worklog filters in the URL | Worklogs work on `/time` as they did on the dashboard; reload and shared links keep filters |
| D2 | Shared range picker and filter bar; existing widgets limited to the period; omitted `projectIds` | An owner with more than 100 projects gets correct totals; previous-period deltas match the same elapsed length |
| D3 | New statistics routes, cross-project agent search and the prompt hold, with tests (screenshots reuse `withScreenshots`) | Access and math tests pass for owner, worker and viewer |
| D4 | New widgets, one commit each, on the shared charts | Each widget's loading, empty, failure and role states render |
| D5 | Translations and visual QA with Playwright screenshots | Every widget checked in en, es, ja, ru and zh, desktop and phone |

## Acceptance tests

| Scenario | Required result |
| --- | --- |
| Worklogs opened from a `/time` link with filters | The same entries as when the link was made |
| This week on a Wednesday | Deltas compare Mon–Wed with last Mon–Wed |
| Owner with 150 projects, "All" | Totals cover all 150 |
| Worker sends another worker's `userIds` | Own data only |
| Viewer opens the dashboard | Tracked, time per day, projects table and app names only |
| Owner selects a worker in the people filter | Your insights still shows the owner's own figures |
| Owner opens the team list | Sorted by name; no metric sorting |
| Agent run during the worker's timer | Counted as assisted, never added to human time |
| `human_wait` segment | Not counted as agent time |
| Worker's prompt inside the review window | Hidden from the owner; shown after publishing or the window |
| Worker's screenshot inside the review window | Missing from the owner's strip |
| Range of 400 days | Refused; the picker stops at 366 |
| Focus session with one 10-minute gap and 50 minutes tracked | Counted as one session |
| One widget's request fails | Only that widget shows the failure, with retry |

## Out of scope

- Tokens and cost, which come with the agent plan's token capture.
- Redesigning the worklogs.
- LLM-written insight narratives.
- Premium gating.
