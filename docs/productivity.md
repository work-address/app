# Productivity plan

Status: confirmed specification from a design review on 13 October 2026. Market research checked 13 October 2026. Baselines: this repository at `05535433`; the desktop tracker at `5b9bd34`; the web repository's `PRODUCT.md` as of the same date. Nothing below exists yet; every field, table, route and phase is a proposed contract.

Work Address records time and turns it into invoices. This plan adds the productivity insights people get from ActivityWatch, RescueTime or Timing, inside the same product, for three kinds of use: a person tracking only for themselves, a freelancer billing one client, and an owner with hundreds or thousands of workers. There are still only three roles (**owner**, **worker**, **viewer**), and "team" and "enterprise" are not product concepts: a large account is an owner with many worker addresses.

Related documents: [SPEC.md](../SPEC.md) holds the domain rules this plan relies on; [app-statistics.md](app-statistics.md) defines app collection, the `Statistics` domain and the project dialog; [agent-time-tracking.md](agent-time-tracking.md) covers agents. This plan builds on app-statistics and changes three of its rules (the Idle line, the timeline, and caching), recorded there as well.

## Product contract

- Tracking happens only while a project timer runs. There is no all-day tracking; insights describe time someone chose to track. A person tracking for themselves uses an ordinary project and ignores billing.
- A worker's own categories, productivity labels and goals are theirs alone.
- An owner sees, for each worker on their projects: time and presence immediately; apps, window titles, browser hostnames and the day timeline once the worker's review window has passed; and that time broken down by the owner's own category set and productive/neutral/distracting labels, which are published to the workers. Never a single productivity score, never a ranking.
- A viewer sees project totals by app name and by the owner's categories, without labels and without per-worker detail.
- The worker always sees exactly what the owner sees about them. Nothing is recorded in secret.
- Invoices bill every tracked minute. Active minutes (minutes with input) are a reference figure.
- Collaboration stops at visibility: who is tracking on which project, reports and shared projects. No schedules, attendance, leave or chat.

### Positioning

Replace the web repository's "without turning time tracking into surveillance" wording with:

> Your personal insights are yours. A project's owner sees your time on it, the apps behind it after your review, and how it falls into their published categories, and you always see exactly what they see.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Audience order | People tracking for themselves and freelancers first; large owner accounts after | Large accounts first; all at once |
| Roles | Owner, worker, viewer only; "team" and "enterprise" are not concepts | Organization domain, team entity, manager role |
| Tracking scope | Timer only | Optional all-day personal tracking; all-day tracking that proposes project time |
| Insight ownership | A worker's own categories, labels and goals are private; the owner's categories and labels apply per worker, published | Owner sees nothing evaluative; seat-threshold rules |
| Scores | No single productivity score, no rankings | Per-person scores and rankings |
| Domains | SPEC's bar for new domains stands; nothing here needs one | A separate productivity subsystem |
| Collaboration | Visibility only | Issue-tracker links, scheduling, attendance, chat |
| Personal tracking | An ordinary project, billing ignored | Rate-less projects that hide billing; a personal project type |
| Review before sharing | Detail is held for a window the owner sets (1–24 h, default 24 h); the worker can publish early and remove items; totals are immediate | No review; nothing uploads until approved |
| Compliance | Transparent by design: no stealth mode, recording always visible, the worker sees what the owner sees, a screenshot retention limit, a DPIA template and employee notice | Configurable stealth |
| Billing basis | Invoices bill all tracked minutes; active minutes are a reference | Billing active minutes (today's code) |
| Idle before auto-stop | Billed by default; the worker can discard it when they return | Discarded by default; never billed |
| App time | Active minutes split among apps, plus an Idle line; apps plus Idle equal billed time | Idle credited to the foreground app; apps equal active time only |
| Manual time | Off by default; the owner switches it on per project; flagged on invoices. The web timer counts as manual | Always allowed; on by default |
| Day timeline | Visible to the worker, and to the owner after the review window | Worker only |
| Viewer | Project totals by app name and owner category, no labels | Nothing; per-worker detail |
| Identity | Wallet sign-in only; no single sign-on for now | SSO gate; custodial wallets |
| Scale | Monthly partitions of `time` and app usage; daily rollups for long ranges and large accounts; screenshots stay in `time` for now | Analytics store; moving screenshots now |
| Account deletion | Delete everything uninvoiced; anonymise invoiced records | Delete everything; block deletion |
| Documents | This plan, SPEC, app-statistics, and the web repository's positioning, G8 and open decision #10 | This plan only |

## Gap analysis

### Where Work Address stands

| Area | Exists | Planned elsewhere | Absent |
| --- | --- | --- | --- |
| Capture | Desktop timer; input counts; screenshots per project; idle auto-stop after 20 min; app snapshots (open apps, names only) | Foreground apps, titles, hostnames ([app-statistics.md](app-statistics.md)); agent runs ([agent-time-tracking.md](agent-time-tracking.md)) | Manual entries; web timer; editor/IDE; calendar; mobile |
| Classification | Notes on entries | — | Categories, rules, labels, tags |
| Insights | Worklog grid with activity tone; dashboard summary; top 4/8 apps | Statistics domain, any range, per-worker apps, Overview/Apps/Agents tabs | Timeline; goals; trends; heatmap; export |
| Focus and wellbeing | Idle-stop notification | — | Goals; focus sessions; reminders |
| Billing | Invoices (3 creation modes), frozen cents, project rate | Rejection, invoice lines, agent lines, weekly cadence, escrow | Billing all tracked minutes |
| Collaboration | Owner/worker/viewer per project; everyone sees all project time | Owner-only per-worker app evidence | Presence; review before sharing |
| Privacy | Counts not keys; monitoring off by default; author can strip screenshots/processes; self-hosting | Private browsing and `local` placeholders; agent field allowlist | Personal redaction rules; data export; account deletion; recording policy shown to the worker |
| Platform | REST API with OpenAPI; desktop for Windows, macOS, Linux; five locales | Agent collector and plugins | Personal API tokens; MCP; integrations |
| AI | None | Agent time tracking | Summaries |

### What the market treats as standard

Sources and the full matrix are in [Market reference](#market-reference).

- **Capture:** apps, URLs, idle detection, manual entry and a browser extension are table stakes. ActivityWatch adds editor watchers and Android; WakaTime adds editor heartbeats and AI-tool usage.
- **Classification:** rule-based categories with productive/unproductive labels everywhere. ActivityWatch uses a category tree with regex rules on app and title, deepest match wins. Rize assigns time to projects with AI.
- **Insights:** dashboards, a timeline and reports are standard. ActivityWatch has timeline, trends and a query language.
- **Focus:** goals are common; RescueTime blocks distractions during focus sessions; workforce products add burnout signals.
- **Billing:** rates, approvals and invoices in Toggl, Clockify, Harvest. ActivityWatch v0.14 (October 2026) added a work-time report and a billable-hours export, moving a free, local tool toward freelancer billing.
- **Collaboration:** Rize lets members approve their data before managers see it; Timing shows admins only project totals.
- **Large accounts:** single sign-on, SCIM, audit logs, data region; deferred here.

### Gaps and decisions

| # | Feature | Decision |
| --- | --- | --- |
| 1 | Manual time entries | **Now** |
| 2 | Web timer | **Now** |
| 3 | Idle return prompt | **Now** |
| 4 | Editor and IDE heartbeats | Later |
| 5 | Calendar import | Later |
| 6 | Mobile app | Later |
| 7 | Categories with rules | **Now** |
| 8 | Productivity labels (private for the worker; published for the owner's set) | **Now** |
| 9 | Tags on entries | Later |
| 10 | Automatic project suggestion | **Never** (the timer decides the project) |
| 11 | Day timeline | **Now** |
| 12 | Trends and heatmap | Later |
| 13 | Report export (CSV, PDF, JSON) | **Now** |
| 14 | Weekly summary | Later (needs the planned notification system) |
| 15 | Goals | **Now** |
| 16 | Focus sessions / Pomodoro | Later |
| 17 | Blocking distracting apps and sites | **Never** |
| 18 | Break reminders and overwork alerts | Later |
| 19 | Personal redaction rules | **Now** |
| 20 | Full data export and account deletion | **Now** |
| 21 | AI summary of a day or week | Later |
| 22 | MCP server | Later |
| 23 | Personal API tokens | Later |

Also decided, beyond the feature list: the review window, presence, the owner's category set and per-worker category view, the viewer's category totals, billing all tracked minutes, the Idle line, transparency, the screenshot retention limit, and partitions and rollups.

## Visibility

| Data | Owner | Worker | Viewer |
| --- | --- | --- | --- |
| Time totals and presence (who is tracking now, on which project) | Every worker, immediately | Every worker on shared projects, immediately | Every worker, immediately |
| Apps, titles, hostnames, Idle line, day timeline | Every worker, after the review window | Own, immediately | Project totals by app name only |
| Time by the owner's categories, with labels | Every worker, after the review window | Own, with the published set and labels | Project totals by category, no labels |
| Worker's own categories, labels and goals | Never | Own | Never |
| Screenshots | As today, after the review window | Own | As today, after the review window |
| Single score or ranking | Never exists | Never exists | Never exists |

**Review window.** Each project has `reviewWindowHours`, set by the owner from 1 to 24 (default 24). An entry's detail (screenshot, app usage, titles, hostnames, timeline) is visible only to its author until they publish it or the window passes since the entry ended. During the window the owner sees the entry's time with "detail pending review". The author can remove a screenshot or app data before publishing. Creating an invoice publishes the detail of the entries it covers.

**Transparency.** The desktop app always shows when it is recording and, read-only, what the current project records (apps, titles, hostnames, screenshots) and its review window. There is no hidden mode. Each project can set a screenshot retention period; older screenshots are removed while their entries remain. Owners get a downloadable DPIA template and an employee notice describing exactly what the project records and who sees it.

## Billing changes

- **All tracked minutes.** `InvoiceManager.amountFor` prices the minutes each entry spans (`toAt − fromAt`), not `minutesActive`. Invoice lines and reports show active minutes and the Idle figure as references. Issued invoices keep their frozen amounts. This settles the web repository's gap G8 and open decision #10, and the project totals already price wall-clock minutes.
- **Idle before auto-stop.** The desktop stops the timer after 20 minutes without input (`src/ActivityCounter.cpp:804-815`), and those minutes stay in the entries. They are billed by default. When the worker returns, the desktop asks "You were idle 20 min before the timer stopped: keep or discard". Discard shortens the affected entries to their last minute with input and deletes entries left with none. Shorter idle stretches never stop the timer and are always billed.
- **Manual time.** A project's `allowManualTime` is off by default; the owner switches it on. Manual entries have `source=manual`, carry no activity evidence, and are flagged on the invoice line and in reports.
- **Web timer.** Starting and stopping the timer in the browser creates entries with `source=web`, treated exactly as manual time: allowed only where manual time is allowed, flagged the same way.

## Feature decomposition

Each feature lists what it does, the work in each component, and its rules. Data model changes are collected after.

### 1. Manual time entries

- **Web:** an "Add time" form on the worklog: project, start, end, note. Edit and delete for the author's own manual entries.
- **API:** `POST /api/time/manual`, `PUT /api/time/:id/interval` (manual entries only), with validation: no overlap with the author's other entries on the project, not in the future, within retention.
- **Rules:** refused when the project's `allowManualTime` is off. Flagged `manual` everywhere. Never carry screenshots or app data.

### 2. Web timer

- **Web:** start and stop in the header for one project at a time; shows elapsed time.
- **API:** `POST /api/time/timer/start`, `POST /api/time/timer/stop`; the server cuts the interval into entries aligned like desktop entries.
- **Rules:** `source=web`; same switch and flag as manual time. A running desktop timer and a web timer on the same project cannot overlap.

### 3. Idle return prompt

- **Desktop:** after an idle auto-stop, the next input shows the prompt with the idle span and **Keep** / **Discard**. If ignored, the time stays billed.
- **API:** `POST /api/time/idle/discard` with the span; trims or deletes the affected entries of that author.
- **Rules:** only the idle span before an auto-stop; never another worker's entries; refused for invoiced entries.

### 4. Categories with rules

- **Model:** a category set is a tree of categories, each with a name, color, optional label (productive, neutral, distracting) and rules. A rule matches `app`, `title` or `domain` by "contains" or a regular expression. The deepest matching category wins; unmatched time is "Uncategorized".
- **Two kinds of set:** a worker's personal set (private) and an owner's set (one per owner account, published to everyone working on the owner's projects).
- **Applied on read** to app usage rows, so a rule change reclassifies history immediately.
- **Web:** a category editor with live preview against the last 7 days; a starter set (Development, Communication, Meetings, Browsing, Design, Writing, Entertainment) the user can edit.
- **API:** CRUD under `/api/statistics/category-sets`; the owner set is readable by the owner's workers.

### 5. Productivity labels

- **Personal labels** sit on the worker's personal categories and are seen only by them.
- **Owner labels** sit on the owner's set; workers see them, and the owner sees each worker's time by those labels.
- Labels drive "productive time" and goal views; there is no combined score.

### 6. Day timeline

- **Resolution:** one block per entry (normally 10 minutes) showing that entry's apps by share, plus Idle. Built from existing app usage rows; no finer-grained storage.
- **Web:** a day view in the project dialog's Apps tab and in the worker's own insights, with project lanes and app colours from the stable palette.
- **Visibility:** the worker immediately; the owner after the review window; never viewers.

### 7. Report export

- **Web:** an export dialog for any range: time entries, app usage, categories, invoices.
- **Formats:** CSV per table, JSON bundle, PDF summary.
- **Rules:** exports contain exactly what the requester can see.

### 8. Goals

- **Kinds:** tracked hours per day or week (total or per project); minimum or maximum time per personal category.
- **Web:** progress on the worker's insights view; no notifications until the notification system exists.
- **Private** to the worker.

### 9. Personal redaction rules

- **Model:** patterns on title or domain, stored in the worker's settings and synced to the desktop.
- **Desktop:** matching titles become "Redacted" and matching hostnames are dropped before data leaves the machine.
- **Owner view:** sees "Redacted", never the original.

### 10. Data export and account deletion

- **Export:** the worker downloads everything about them (profile, entries, app usage, categories, goals, invoices) as a JSON bundle with CSV files.
- **Deletion:** removes profile, settings, personal sets and goals, and every uninvoiced entry and its detail. Invoiced entries, runs and invoices remain with the person shown as "Deleted user"; their address is kept only on those records, until the owner's retention allows removal.

### Cross-cutting work

- **Owner category view:** per-worker time by owner categories and labels in the project dialog; viewers get project totals by category without labels.
- **Presence:** "tracking now" per project from open timers, visible to everyone who can see the project's time.
- **Transparency:** desktop recording indicator and read-only policy; screenshot retention; DPIA template and employee notice.
- **Scale:** monthly partitions; daily rollups.

## Data model

All changes are additive and follow the repository's `schema:sync`.

| Where | Change |
| --- | --- |
| `time` | `source` (`desktop`, `manual`, `web`; default `desktop`); `publishedAt` (null until published or the window passes). Idle minutes are derived: tracked minutes minus `minutesActive` |
| `Project` | `allowManualTime` (default false); `reviewWindowHours` (1–24, default 24); `screenshotRetentionDays` (null = keep) |
| `User` | Settings: personal redaction rules |
| `Statistics` | `category_set` (owner user, kind `personal` or `owner`); `category` (set, parent, name, color, label); `category_rule` (category, field, match, pattern); `goal` (user, kind, period, target, project or category) |
| `Statistics` | `usage_daily` rollup: (day, project, user, app, title, domain) with seconds and idle seconds; rebuilt per day from raw rows; categories applied on read |
| Partitions | `time` and `app_usage` by month |

Invoices still read raw `time` rows; rollups never feed anything that must match an invoice.

## API

All new contracts under `/api`, scoped by the visibility table.

| Route | Purpose |
| --- | --- |
| `POST /time/manual`, `PUT /time/:id/interval` | Manual entries |
| `POST /time/timer/start`, `POST /time/timer/stop` | Web timer |
| `POST /time/idle/discard` | Discard idle before auto-stop |
| `POST /time/publish` | Publish reviewed entries early |
| `GET/POST/PUT/DELETE /statistics/category-sets` and nested categories and rules | Categories |
| `POST /statistics/categories` | Time by categories for a range; personal or owner set |
| `POST /statistics/timeline` | Day timeline |
| `GET/POST/PUT/DELETE /statistics/goals` | Goals and progress |
| `GET /project/:id/presence` | Who is tracking now |
| `POST /export` | Report and data export |
| `DELETE /user/me` | Account deletion |

## User interface

- **Worker:** an insights view on the dashboard (today, this week; time by personal categories; goals; timeline); a review queue of entries pending publication with **Publish** and per-item remove; "Add time" and the web timer where allowed; export; account deletion in profile settings.
- **Owner:** in the project dialog's Apps tab, per-worker time by the owner's categories with labels, the day timeline and the Idle line; project settings for manual time, review window, screenshot retention and the category set; the DPIA template and employee notice.
- **Viewer:** project totals by app name and category.
- **Desktop:** recording indicator and read-only project policy; idle prompt; redaction rules applied before upload.

Use the repository's Effector/Farfetched data flow, Feature-Sliced Design, styled-components and shared UI, and the shared chart components from app-statistics.

## Phases

Builds on app-statistics Phase 1 (the Statistics domain) and Phase 2 (foreground collection).

| Phase | Work | Exit condition |
| --- | --- | --- |
| P1 | Billing all tracked minutes; Idle line; idle return prompt | New invoices price all minutes; issued invoices unchanged; apps plus Idle equal billed time |
| P2 | Review window, presence, transparency (recording indicator, read-only policy, screenshot retention, DPIA template, notice) | Owner sees no detail before publication or the window; worker sees everything the owner sees |
| P3 | Category sets, rules and labels; owner per-worker category view; viewer category totals; day timeline; goals | Reclassification on rule change; visibility per the table |
| P4 | Manual entries and web timer behind the project switch; report export; personal redaction rules | Flags on invoices and reports; exports match visibility; redacted values never leave the machine |
| P5 | Full data export and account deletion | Uninvoiced data gone; invoiced records anonymised |
| P6 | Monthly partitions and daily rollups | Account-wide reports over a year for 1,000 workers within the operational target; invoice totals still exact |

**Later:** editor heartbeats, calendar import, mobile, tags, trends and heatmap, weekly summary, focus sessions, break reminders, AI summary, MCP server, personal API tokens, single sign-on, moving screenshots to object storage. **Never:** automatic project suggestion, distraction blocking, stealth mode, single scores or rankings.

## Acceptance tests

| Scenario | Required result |
| --- | --- |
| Entry of 10 minutes with 7 active | Billed 10 minutes; reference shows 7 active, 3 Idle; apps total 420 s plus 180 s Idle |
| Idle auto-stop, worker keeps | The idle minutes stay billed |
| Idle auto-stop, worker discards | Entries trimmed to last input; empty ones deleted; invoiced entries refused |
| Manual entry on a project with manual time off | Refused |
| Manual entry and web timer allowed | Stored with `source`; flagged on invoice lines and reports |
| Owner opens a worker's entry inside the review window | Time shown; detail "pending review" |
| Worker publishes early or the window passes | Owner sees the detail |
| Invoice created for unpublished entries | Their detail is published |
| Worker removes a screenshot before publishing | Owner never sees it |
| Owner changes a category rule | History reclassified on next read |
| Worker's personal categories, labels, goals | Never returned to an owner or viewer |
| Owner views a worker | Time by owner categories with labels; no score or ranking anywhere |
| Viewer views a project | Totals by app name and category; no labels, no per-worker detail, no titles |
| Redaction rule matches a title | "Redacted" stored; original never uploaded |
| Account deletion with invoiced entries | Uninvoiced data deleted; invoiced records show "Deleted user" |
| Export as worker, owner, viewer | Contents match visibility |
| Year-long account-wide report, 1,000 workers | Served from rollups within target; invoice totals from raw rows |
| Desktop recording | Indicator visible; current project's policy shown |

## Legal and compliance notes

- **CNIL, France:** €40,000 fine (19 December 2024, published 4 February 2025) on an employer for idle detection after 3–15 minutes, screenshots every 3–15 minutes and time on sites labelled "unproductive", with no legal basis, insufficient information and no impact assessment (GDPR Articles 5.1.c, 6, 12, 13, 32, 35). Amazon France Logistique was fined €32M in December 2023 for measuring idle time to the second. [CNIL €40k](https://www.cnil.fr/fr/surveillance-excessive-des-salaries-sanction-de-40-000-euros-entreprise-secteur-immobilier), [CNIL Amazon](https://www.cnil.fr/en/employee-monitoring-cnil-fined-amazon-france-logistique-eu32-million)
- **UK ICO (October 2023):** impact assessment, worker information, least intrusive means. [Summary](https://www.hfw.com/insights/ICO-Publishes-Guidance-on-Monitoring-Workers)
- **Germany:** BetrVG §87(1) no. 6 gives works councils co-determination over technical monitoring of behaviour or performance. [BetrVG](https://www.gesetze-im-internet.de/englisch_betrvg/englisch_betrvg.html)
- **EU AI Act:** emotion recognition at work is prohibited (Art. 5(1)(f)); AI that monitors or evaluates workers is high-risk (Annex III). Work Address computes no AI-driven evaluation of people.
- **Microsoft Productivity Score** removed per-user views in December 2020 after criticism.

These are why the plan has no score, no ranking, no stealth mode, a review window, a worker view identical to the owner's, a DPIA template and an employee notice.

## Market reference

Researched 13 October 2026 from official documentation and source code.

| Product | Notable for |
| --- | --- |
| ActivityWatch | Local-first, open source; window, AFK, web and editor watchers; regex category tree; timeline, trends, query language; v0.14 adds work report, billable export, title redaction, multi-device views. [Release](https://github.com/ActivityWatch/activitywatch/releases/tag/v0.14.0), [docs](https://docs.activitywatch.net/en/latest/) |
| RescueTime | Productivity levels, focus sessions with blocking, goals. [Tour](https://www.rescuetime.com/tour) |
| Rize | AI categorization to client and project; members approve data before managers see it. [AI features](https://docs.rize.io/automatic-tracking/ai-features) |
| Timing | Rules assign time to projects; admins see only project totals. [Timing](https://timingapp.com) |
| WakaTime | Editor heartbeats, AI-tool usage, goals. [Features](https://wakatime.com/features) |
| Toggl Track, Clockify, Harvest | Timers, manual entries, approvals, invoices, rates, reports. [Toggl](https://toggl.com/track/pricing), [Clockify](https://clockify.me/pricing), [Harvest](https://www.getharvest.com/pricing) |
| Hubstaff, Time Doctor, Insightful, ActivTrak | Workforce monitoring: screenshots, productivity ratings, payroll, SSO; stealth modes in Time Doctor and Insightful. [Hubstaff](https://hubstaff.com/how-tracking-works), [Time Doctor](https://support.timedoctor.com/knowledge/silent-vs.-interactive-apps), [Insightful](https://help.insightful.io/en/articles/3277722-insightful-visibility-settings), [ActivTrak](https://support.activtrak.com/hc/en-us/articles/360050977352-What-Data-Does-ActivTrak-Collect) |
