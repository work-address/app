# App statistics plan

Status: confirmed implementation specification from a design review on 13 October 2026. Baselines: this repository at `739e9923` (on `dev` `1fceeaad`); the desktop tracker (`work-address/time-tracker`) at `5b9bd34`. Nothing below exists yet; every API, field, table and phase is a proposed contract.

Work Address should show a project owner what paid time went into: which apps, windows and sites a worker used during the minutes they are billed for, and what their agents did. Workers see the same views for their own work. This plan covers desktop collection, a `Statistics` domain that stores normalized usage and aggregates it on read, the statistics API, and a larger project dialog with charts.

Related documents: [SPEC.md](../SPEC.md) defines the `Statistics` domain and its rule; [agent-time-tracking.md](agent-time-tracking.md) defines how agent runs, tokens and tool usage are captured. This plan only presents agent data; it does not change how it is collected.

## Product contract

- Statistics are designed around the owner checking billed time. Workers get the same views, limited to their own data.
- App time is **foreground** time: the app the person was using, not every app that was open.
- App time splits the **active minutes** (minutes with keyboard or mouse input) among apps; the entry's idle minutes appear beside them as an **Idle** line, so apps plus Idle add up to the entry's tracked, billed time. Revised 13 October 2026, when invoices moved to billing every tracked minute ([productivity.md](productivity.md)).
- The desktop app records the app name, the window title and, for browsers, the full hostname. Never full URLs, paths or page content.
- The project owner decides, per project, whether apps, titles, domains and screenshots are recorded. The desktop app shows the worker exactly what the project records.
- Missing data looks missing. A permission gap, an unsupported desktop or an old desktop app shows as a gap with its reason, never as idle time.
- Statistics accept any date range in the viewer's timezone, plus "this invoice", whose totals match the invoice exactly.
- Human and agent hours are shown side by side and never added together; money may be.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Audience | Built for the owner; workers see their own | Worker self-insight first; marketplace signals |
| What app time means | Foreground time split over active minutes, plus an Idle line; apps plus Idle equal billed time | Open apps; idle minutes credited to the foreground app; apps equal active time only |
| Detail | App name, window title (≤ 200 chars), browser full hostname | Full URLs and file paths; registered domain only |
| Browser domains | Read natively per OS: Apple Events on macOS, UI Automation on Windows | Browser extensions |
| Private and local | Private windows recorded as "Private browsing" without a domain; `localhost`, IPs and `*.local` recorded as "local" | Recording them as is |
| Who controls collection | The project owner, per item; desktop shows it read-only | Worker opt-outs |
| Gaps | `appsStatus` on every entry; shown in statistics | Desktop-only warning |
| Wayland | Reported as unavailable; X11 and XWayland sessions only | Per-compositor integrations; today's guess |
| Domain | `Statistics` replaces `ProjectStatistics` and stores normalized usage rows | A sixth domain; a rollup or period cache |
| Agent tool usage | Normalized rows in `Statistics`; scalar run fields stay on `time_agent` | JSON on the run |
| Aggregation | SQL on read over normalized rows joined to their entry; daily rollups for long ranges and large accounts, never for invoice figures ([productivity.md](productivity.md)) | Hourly rollups as the only source; the lazy period cache |
| Ranges | Any range, presets, "this invoice", viewer timezone | Rolling windows ending now |
| Old data | Read-only legacy; excluded from charts with a notice | Mixed into charts |
| Visibility | Owner: all workers with titles, domains and the day timeline, after the worker's review window. Worker: own. Viewer: project app totals by name | Everyone sees everything; detail before review |
| Surface | The project dialog, larger, with Overview, Apps and Agents tabs | A new project page |
| Plan location | This document | Merged into the agent plan |

## What exists today

**Desktop collection** (`time-tracker`):

- Each sample is a snapshot of every app with a window, not the foreground app (`src/ActivityCounter.cpp`, `getProcessList()`): `EnumWindows` on Windows (~1285-1319), `osascript` asking System Events for non-background processes on macOS (~1480-1520), `_NET_CLIENT_LIST` on X11 (~1430-1440), and on Wayland a heuristic over `ss -xp` that keeps clients holding a GPU render node (~1352-1413).
- One snapshot per minute; every app in it is credited with the whole minute (`qml/RestApiSet.qml:670-686`). The upload sends `processes: [{name, timeMin}]` per entry. Titles, paths and pids are discarded; `description` is never sent.
- The list is capped at 20 (`src/ActivityCounter.h:49`) after sorting by start time **ascending**, so the 20 oldest windows are kept and newer apps are dropped; duplicates are removed only after the cut (`src/ActivityCounter.cpp:1456-1467`).
- Any error output from the macOS query latches and stops collection until the project setting changes (`:717`, `:1502-1506`); the only signal is a tooltip (`qml/ProjectPage.qml:160-167`). `cmake/Info.plist.in` has no Apple Events purpose string.
- Collection follows only the server's `Project.trackProcesses`, default off (`qml/RestApiSet.qml:361-369`). The desktop "Apps running" and "URLs visited" checkboxes are not connected to anything (`qml/DataOptions.qml:38-43`).
- Names are stored comma-joined in SQLite and split on read (`src/SqliteDatabase.cpp:300`, `:523-524`), so names containing a comma split on Windows and macOS. A stray `procQueryId` is sent (`qml/RestApiSet.qml:662`). The final partial minute is never sampled. Only aggregation is tested (`tests/RuntimeTests.cpp:455-542`).

**Storage and aggregation** (`app/api`):

- `Time.processes` is jsonb validated only as an array (`api/src/model/dto/time.ts:162-168`) and stored verbatim (`api/src/service/time-manager.ts:125`), whether or not the project tracks processes.
- `ProjectStatistics` is a cache keyed `(project, period, processName)` with no worker dimension (`api/src/entity/project-statistics.ts`). Periods are rolling windows ending now: `1D`, `7D`, `1W`, `1M`, `6M`, `1Y`.
- It is rebuilt lazily on read when empty or stale (`api/src/service/project-statistics-manager.ts:24-47`): hourly for a day, up to monthly for a year. Rebuilds delete and reinsert without a lock, so concurrent reads can fail on the unique key. The only endpoint is `GET /api/project/:id/stats/:period` (`api/src/controller/project-controller.ts:132-158`), open to owners, workers and viewers alike.
- Every role can search every time entry on the project, including other workers' screenshots and process lists (`api/src/repository/time-repository.ts:612-633`).

**Rendering** (`app/web`):

- The time dialog lists an entry's processes shortest first, with durations only in a tooltip (`web/src/features/time/ui/time-dialog/time-dialog-processes.tsx:45`).
- The project dialog (`DIALOG_WIDTH_WIDE`, 920 px) shows a Recharts bar chart of the top 8 processes for a week, month or year (`web/src/features/projects/model/project-usage-chart.ts`).
- The dashboard shows the top 4 processes per project, one request per project (`web/src/features/dashboard/model/applications-usage-chart.ts:47-58`, `web/src/entities/projects/projects.queries.ts:65-110`).
- Recharts 3 is installed; there are no shared chart components. There is no project page or route.

## Desktop collection

### What is measured

The tracker follows the foreground window continuously: it records each switch as the operating system reports it and rereads the focused window's title every 5 seconds. At the end of each minute:

- If the minute was **active** (it had input), its 60 seconds are divided among the foreground apps in proportion to how long each was in front during that minute.
- If the minute was **inactive**, nothing is attributed.
- If the minute was active but no foreground app was observed (unsupported session, missing permission), it counts as unrecorded and the entry's status reflects it.

Example: a 10-minute entry with 7 active minutes yields app time totalling 420 seconds and an Idle line of 180 seconds; the entry bills all 600. Within one active minute, 40 seconds in Code and 20 in Chrome become Code 40 s and Chrome 20 s. A minute spent reading in Chrome with no input adds nothing.

Collection runs only while the human timer runs, as today. Agents are covered by the agent plan and never trigger app collection.

### What is recorded

| Item | Rule |
| --- | --- |
| App | Display name of the foreground application, ≤ 200 characters |
| Window title | Focused window title, trimmed and truncated to 200 characters; recorded only when the project records titles |
| Domain | Browsers only: the active tab's full hostname, lowercased, IDN in punycode, no scheme, port, path, query or fragment; recorded only when the project records domains |
| Private windows | Title replaced by "Private browsing"; no domain. If a browser's private windows cannot be detected on an OS, domains are not recorded for that browser there |
| Local addresses | `localhost`, IPv4/IPv6 literals and `*.local` recorded as `local` |

### How, per OS

| OS | Foreground app | Window title | Browser domain |
| --- | --- | --- | --- |
| macOS | `NSWorkspace` frontmost application and activation notifications; no permission | Accessibility API on the focused window (permission already requested for input counting) | Apple Events, run in process, to Safari and Chromium-family browsers (Chrome, Edge, Brave, Arc); one consent prompt per browser; needs `NSAppleEventsUsageDescription`. Firefox: not available |
| Windows | `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` and `GetForegroundWindow` | `GetWindowText` | UI Automation on the address bar of Chrome, Edge and Firefox |
| Linux X11 / XWayland | `_NET_ACTIVE_WINDOW` with property-change events | `_NET_WM_NAME` / `WM_NAME` | Not available |
| Linux Wayland | Not available: status `unsupported` | — | — |

The `osascript`/System Events path and its Automation permission are removed, as is the Wayland `ss` heuristic. Phase 0 confirms each mechanism, including private-window detection per browser, before it is built.

### Project settings and status

`Project` gets owner-only switches beside the existing `trackScreenshots` and `trackProcesses`: `trackWindowTitles` and `trackBrowserDomains`. Titles and domains require apps. The desktop app removes its unconnected checkboxes and shows, read-only, what the current project records. The server enforces the switches: it drops app data, titles or domains the project does not record, whatever the client sends.

Every uploaded entry carries `appsStatus`:

| Value | Meaning |
| --- | --- |
| `ok` | Every active minute has foreground data |
| `partial` | Some active minutes have none; `appsReason` says why |
| `off` | The project does not record apps |
| `permission_missing` | A required OS permission is missing; `appsReason` names it |
| `unsupported` | The session cannot report the foreground window (Wayland) |
| `error` | Collection failed; the desktop retries every minute with backoff instead of latching |
| `invalid` | Set by the server when it rejects the entry's app data (see below) |

An entry without `appsStatus` comes from an older desktop app. Statistics show it as the gap "recorded by an older desktop app".

### Upload format

`TimeCreateDto` gains, alongside the legacy `processes` field:

```json
{
  "appsStatus": "ok",
  "appsReason": null,
  "apps": [
    {
      "name": "Google Chrome",
      "seconds": 240,
      "titles": [
        { "title": "Pull request #42", "domain": "github.com", "seconds": 180 },
        { "title": "Private browsing", "domain": null, "seconds": 60 }
      ]
    },
    { "name": "Code", "seconds": 180, "titles": [] }
  ],
  "appsTruncated": false
}
```

At most 30 apps per entry and 20 titles per app. The desktop keeps the largest by seconds and folds the remainder into an app or title named "Other", setting `appsTruncated`. Seconds are positive integers; an app's titles never add up to more than the app. Validation is nested (`ValidateNested`, `ArrayMaxSize`, string lengths, hostname format).

### Fixes in the same rewrite

- Store each minute's apps in SQLite as a JSON array, not a comma-joined string.
- Stop sending `procQueryId`.
- Sample the final partial minute when the timer stops, switches project or the machine suspends.
- Add unit tests for the active-minute split, the caps and domain normalization, and per-OS tests for the foreground backends where CI allows (Xvfb on Linux; Windows and macOS runners).

## Statistics domain

`Statistics` replaces `ProjectStatistics`. It holds normalized breakdowns of Time records and computes every report on read. The rule (SPEC): **Statistics explains time; it never records it.** A breakdown of a record lives in Statistics; the record's own fields stay on the record.

### Tables

`app_usage`: one row per time entry, app, title and domain.

| Column | Rule |
| --- | --- |
| `id` | UUID |
| `timeId` | The `time` entry; `ON DELETE CASCADE` |
| `app` | ≤ 200 characters |
| `title` | ≤ 200 characters, nullable (none recorded, or titles off) |
| `domain` | Hostname or `local`, nullable |
| `seconds` | Positive integer |

Unique `(timeId, app, title, domain)` with nulls treated as equal; index `timeId`. An entry's rows never add up to more than its `minutesActive × 60` seconds. Idle is not stored: it is the entry's tracked seconds minus that.

`agent_tool_usage`: one row per agent run and tool, written by the agent normalizer from the run's content event.

| Column | Rule |
| --- | --- |
| `id` | UUID |
| `runId` | The `time_agent` run; `ON DELETE CASCADE` |
| `tool` | Tool name only, ≤ 100 characters |
| `count` | Positive integer |
| `durationMs` | Nonnegative, nullable when the source gives none |

Unique `(runId, tool)`. A run can call tools in parallel, so durations may overlap: they are shown per tool and as counts, never added into a time total.

On `time`: `appsStatus`, `appsReason` and `appsTruncated`, the entry's own fields. Tokens, model and timings stay on `time_agent`.

### Writing

- The upload writes an entry's `app_usage` rows in the same transaction as the entry. Re-uploading an entry replaces its rows.
- The server applies the project's switches first, then validates. Invalid app data never blocks time: the entry is stored without app rows, with `appsStatus=invalid`.
- "Remove processes" on an entry, single or bulk, deletes its `app_usage` rows and clears its legacy `processes`.
- Usage rows follow their entry: unreachable when the entry is soft-deleted by retention or removal, deleted with it on hard delete, and kept with invoiced entries as the invoice's evidence.
- The legacy `processes` JSON stays on `time`, read-only. Nothing migrates it.

### Aggregation

Reports are SQL `GROUP BY` queries over `app_usage` joined to its `time` entry, filtered by project, `time.fromAt` range, `time.deletedAt IS NULL` and the caller's visibility. The join uses the existing `(projectId, fromAt)` unique index. Raw queries are never stale. For long ranges and accounts with many workers, a daily rollup at (day, project, user, app, title, domain) serves reports; it is rebuilt from the rows and never used where a figure must match an invoice ([productivity.md](productivity.md)).

- **Range:** `from` and `to` as dates in the viewer's IANA `timeZone`, converted to UTC instants; at most 366 days. Day buckets use the same timezone.
- **Invoice:** with `invoiceId`, the query selects exactly the entries and runs linked to that invoice, so totals match its lines.
- **Old data:** only entries with `appsStatus` count. If the range contains entries without it, the response reports their active minutes as a legacy gap, and the UI shows "app data was recorded differently before {date}".
- **Gaps:** active minutes not covered by usage rows are returned per reason (`permission_missing`, `unsupported`, `error`, `invalid`, `partial`, older desktop app). `off` is shown as a setting, not a gap.

Agent reports aggregate `time_agent` (billed time, tokens, runs) and `agent_tool_usage` under the agent plan's visibility rules.

### API

All routes are new contracts with the `/api` prefix. Each takes `{projectIds, from, to, timeZone, userIds?, invoiceId?}`.

| Route | Returns | Access |
| --- | --- | --- |
| `POST /api/statistics/overview` | Human tracked and active minutes; agent billed minutes; money as human, agent and combined; gaps | Owner: all. Worker: own. Viewer: human time only |
| `POST /api/statistics/apps/summary` | Active minutes, apps used, top app, gap minutes by reason | Owner, worker (own), viewer (project) |
| `POST /api/statistics/apps/daily` | Seconds per day per app, top 8 plus "Other" | Same |
| `POST /api/statistics/apps/ranking` | Apps with seconds, share and a daily series for sparklines | Same |
| `POST /api/statistics/apps/titles` | For one app: titles and domains with seconds | Owner; worker for their own entries. Never viewers |
| `POST /api/statistics/apps/workers` | Seconds per worker per app | Owner only |
| `POST /api/statistics/apps/projects` | Top apps per project for the dashboard, in one request | Per project, as above |
| `POST /api/statistics/agents/daily` | Billed minutes per day per agent, tokens per day | Owner: all. Worker: own. Never viewers |

The agent runs table reuses the agent plan's `POST /api/agent-tracking/search`. `GET /api/project/:id/stats/:period` is removed with the cache.

### Visibility

| | Owner | Worker | Viewer |
| --- | --- | --- | --- |
| App statistics | Every worker, per worker, after review | Own only | Project totals by app name |
| Titles and domains | Every worker, after review | Own only | Never |
| Day timeline | Every worker, after review | Own | Never |
| Titles and domains inside time entries | Every entry | Entries they authored | Never |
| Agent statistics | Every worker's agents | Own agents | Never |

The server enforces these rules on every statistics response and on time search, which strips titles and domains from entries the caller may not see in full. A worker's `userIds` filter is forced to themselves; a viewer's breakdowns stay project-level. Screenshots and app names inside time entries keep today's visibility. Detail is held from the owner and viewers until the worker publishes it or the project's review window (1–24 hours, default 24) passes; see [productivity.md](productivity.md).

### Removing the period cache

Remove the `ProjectStatistics` entity, repository, manager and endpoint. `schema:sync` does not drop the orphaned `project_statistics` table; release notes tell operators they may drop it.

## UI

### Project dialog

View mode grows to a new `DIALOG_WIDTH_XL`: `min(1200px, 92vw)` wide and 90% of the viewport high, scrolling inside. On phones it stays the `AdaptiveDialog` drawer, at 95% of the screen. Edit mode keeps its current size and gains the new tracking switches.

Three tabs share one range picker:

- **Overview:** human time, assisted agent time and autonomous agent time as three separate figures, never added; money as human, agent and combined; gaps. Assisted agent time is agent time that ran while the same worker's own timer ran on the project ([agent-time-tracking.md](agent-time-tracking.md)).
- **Apps:**
  - Summary tiles (`StatStrip`): tracked time, active time, apps used, top app, gaps.
  - Daily time stacked by app, top 8 plus "Other", with Idle as its own band.
  - Ranked app table: time, share, sparkline; rows expand to titles and domains for those allowed.
  - Per-worker stacked bar, owner only.
  - Day timeline: one block per entry showing its apps and Idle; time by the owner's categories and labels ([productivity.md](productivity.md)).
- **Agents:** billed time per day by agent, stacked into assisted and autonomous, tokens per day, and the runs table grouped by task. Hidden from viewers; a worker sees their own agents.

**Range picker:** this week, last week, this month, last month, this year, and a custom range. Opened from an invoice, it preselects "this invoice". Days follow the viewer's timezone.

### Shared charts

Add chart components under `web/src/shared/ui/charts/`: stacked daily bars, ranked table with a sparkline cell, per-worker stacked bar, and a tokens series. Colours are assigned per app from a stable hash so an app keeps its colour across charts. Reuse `chart-hour-axis`, `StatStrip`, `Tabs`, `DataTable` and `StateNotice`.

### Time dialog

The per-entry list shows apps longest first with durations inline, expanding to titles and domains for the owner and the entry's author. Legacy entries show their old list under the heading "Open apps", also longest first.

### Dashboard

The applications aside uses `POST /api/statistics/apps/projects` in one request and the shared chart components, still showing the top 4 per project.

### States

Loading, empty range, apps off for this project, gaps with their reasons, legacy data before a date, older desktop app, Wayland unsupported, permission missing, and no agents attached.

Use the repository's Effector/Farfetched data flow, Feature-Sliced Design, styled-components and shared UI. No API calls from components.

## Phases

This plan's Phase 1 (the Statistics domain) ships first, before the agent plan's Phase 1 (invoice rejection) and before any agent work. Its later phases run independently of the agent plan, except Phase 4.

| Phase | Work | Exit condition |
| --- | --- | --- |
| 0 | Spike on macOS, Windows and X11: foreground app and switch events, titles, browser domains per browser, private-window detection, CPU cost of 5-second title polling | Each mechanism confirmed or marked unavailable, per OS and browser |
| 1 | `Statistics` domain: `app_usage`, `appsStatus` fields, upload format and validation, server-side switches, project switches, statistics API with visibility, time-search filtering, removal of the period cache, legacy handling | API tests below pass; old desktop uploads still accepted and shown as legacy |
| 2 | Desktop collector rewrite: foreground backends, active-minute split, titles, domains, status, read-only settings, fixes and tests | Real sessions on each OS produce app time equal to active time, with truthful status |
| 3 | Web: XL project dialog, Overview and Apps tabs, range picker, shared charts, time dialog list, batched dashboard | UI tests for each role and state pass |
| 4 | Agents tab, once the agent plan's Phase 3 has shipped `time_agent` and `agent_tool_usage` (the table references `time_agent`, so it ships there) | Agent charts and runs table respect agent visibility |

## File plan

- `api/src/entity/app-usage.ts`, `agent-tool-usage.ts` and repositories; `api/src/service/statistics-manager.ts`; `api/src/controller/statistics-controller.ts`; `api/src/model/dto/statistics.ts`.
- Changes to `api/src/entity/time.ts`, `api/src/model/dto/time.ts`, `api/src/service/time-manager.ts`, `api/src/repository/time-repository.ts` (search filtering), `api/src/entity/project.ts`, project edit DTOs, `app/app-container.ts`, generated clients.
- Remove `api/src/entity/project-statistics.ts`, `api/src/model/project-statistics.ts`, `api/src/service/project-statistics-manager.ts`, `api/src/repository/project-statistics-repository.ts` and the stats route.
- `web/src/shared/ui/charts/`; `web/src/entities/statistics/` for queries; `web/src/features/project-statistics/` for the tabs and range picker; changes to `projects-dialog`, `time-dialog-processes`, the dashboard applications aside, `shared/ui/dialogs/model`.
- `time-tracker`: a foreground tracker with per-OS backends under `src/` (`src/darwin/`, `src/windows/`, X11), changes to `ActivityCounter`, `SqliteDatabase`, `qml/RestApiSet.qml`, `qml/DataOptions.qml`, `qml/ProjectPage.qml`, `cmake/Info.plist.in`, and tests.

Verification entry points: `pnpm --filter ./api test`, `pnpm --filter ./api build`, `pnpm --filter ./web test`, `pnpm --filter ./web build`, `pnpm --filter ./web lint`; `ctest` in the desktop repo. Regenerate clients with `pnpm codegen:api-client` and `pnpm --filter @app/api-client codegen:web`. `pnpm --filter ./api test` wipes the shared development database.

## Acceptance tests

| Scenario | Required result |
| --- | --- |
| Entry with 7 active minutes across two apps | App seconds total 420, split by foreground share per minute; Idle 180; the entry bills 600 |
| Inactive minute with an app in front | Adds no app time |
| More than 30 apps or 20 titles in an entry | Largest kept; remainder in "Other"; `appsTruncated` set |
| Project records apps but not titles or domains | Server stores apps only, whatever the client sent |
| Project does not record apps | No rows stored; `appsStatus=off` |
| App seconds exceed active time or malformed data | Entry stored; app data dropped; `appsStatus=invalid` |
| Re-upload of an entry | Its rows replaced, not duplicated |
| Remove processes, single and bulk | Rows deleted and legacy JSON cleared |
| Retention purges an entry | Its usage no longer counted; invoiced entries keep theirs |
| Owner, worker and viewer request each statistics route | Owner sees all workers with titles; worker only themselves; viewer project totals by name, no titles, no per-worker, no agents |
| Worker or viewer searches another worker's time entry | Titles and domains stripped; screenshots and app names as today |
| Range in a non-UTC timezone, including a half-hour offset | Day buckets follow that timezone exactly at entry granularity |
| Range covering an invoice | "This invoice" totals equal the invoice's human line |
| Range reaching back before the change | Legacy minutes reported as a gap with the notice |
| Old desktop app uploads | Accepted; shown as "recorded by an older desktop app" |
| Concurrent statistics requests | No errors; no shared mutable cache |
| Private browser window | Title "Private browsing", no domain |
| `localhost:3000` in a browser | Domain `local` |
| macOS without Accessibility or browser consent | `permission_missing` with the permission named; apps still recorded where possible |
| Wayland session | `unsupported`; shown as a gap |
| Agent run with parallel tools | Tool rows show counts and durations; never summed into time |

## Later

A weekday × hour heatmap; agent model and tool mix and outcome rates; browser extensions to cover Firefox on macOS, Linux and Wayland; per-compositor Wayland support; whether other workers should keep seeing each other's screenshots.
