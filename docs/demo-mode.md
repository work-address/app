# Demo mode

Status: confirmed specification from a design review on 25 October 2026. Baseline: `feat/0-dashboard-split`. Modelled on creds-app's demo mode (`apps/web/src/shared/mock`).

Demo mode runs the web app with no backend: MSW answers every API request from a seeded in-memory database, and a panel in the bottom-left corner switches who you are and what data there is. It exists to show and test every screen in every state - empty, one project, dozens, a worker's view, an owner's view - without seeding a database or signing in with a wallet.

Related documents: [dashboard-rework.md](dashboard-rework.md) defines the statistics routes the mock answers; [app-statistics.md](app-statistics.md) and [productivity.md](productivity.md) define the visibility rules it has to follow.

## Flag

| | `pnpm dev` | `pnpm build` |
| --- | --- | --- |
| Default | Demo on | Demo off; the mock layer is not in the bundle |
| Opt out / in | `VITE_DEMO=false`, or `pnpm dev:live` | `VITE_DEMO=true`, or `pnpm build:demo` |

`DEMO_MODE` in `web/src/shared/config/demo.ts` reads it. `main.tsx` guards the mock layer with literals Vite inlines (`import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true'`), so a plain build drops `msw` and the fixtures entirely. The live launch configs set `VITE_DEMO=false`. Local use only; no hosted demo for now.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Data source | MSW in the browser over a seeded in-memory database | Seeding presets into the real API; a hybrid |
| Statistics | The mock applies the API's scope, visibility and review-window rules; the pure rules live in `packages/statistics-core`, shared by API and mock | Simplified figures in the mock |
| Presets | Two independent choices: Role × Data world | A flat list of named presets |
| Roles | Owner, Worker, Viewer, Mixed (owns some projects, works on others) | Pure roles only |
| Session | Starts signed in as the chosen role; sign-out works; a wallet sign-in signs in as the role; `/connect` succeeds at once | Starting signed out |
| Edits | Persist in localStorage per role and world until Reset | Lost on reload |
| Timeline | Relative to today, stable within the day, in the browser's timezone | Fixed dates |
| Images | Generated in the browser: screenshot-like canvases, initial avatars | Remote image hosts |
| Panel language | English only | Translated |

## Panel

A "Demo" pill in the bottom-left corner, above the app, expands into:

1. **Role** - Owner, Worker, Viewer, Mixed.
2. **Data** - the world (below), with Shuffle for Random.
3. **Profile** - Fresh (wallet only) or Finished (name, title, company, bio, rate, skills, socials).
4. **Plan** - Premium or Free.
5. **Network** - speed (instant, fast, slow), failure (none, every request), and fail the next request.
6. **Scenarios** - a worker uploads time now; an agent run finishes with a prompt; the owner marks an invoice paid; a review window passes.
7. **Reset demo data.**

## Worlds

| World | Projects | Time | Team (owner, mixed) |
| --- | --- | --- | --- |
| Empty | None | None | None |
| Starter | 1 | A few entries this week | 1 worker |
| Typical | 3-5 | A few weeks | 3 workers, 1 viewer |
| Busy | Dozens, past the API's 100-id limit | Months | 25 workers, some on several projects |
| Random | Typical's shape, every name and figure redrawn | | Shuffle draws another |

Every non-empty world has agents with runs, prompts and held prompts; screenshots and app usage, with some projects tracking them off; entries still inside their review window; invoices requested, paid and rejected; manual and web time; an agent run in progress.

For each role the projects are: **Owner** owns all; **Worker** works on projects others own; **Viewer** only views others' projects; **Mixed** owns some and works on others.

## What the mock answers

Every route the web calls: auth, profile, projects, time (search, totals, edit, delete, paid, screenshots, processes, publish), invoices, agent runs and attachments, the desktop tracker connect, and every `/statistics/*` route. Statistics follow the API exactly: owners see every worker and detail after review; workers their own; viewers project totals; `paidSeconds` and detail never reach a viewer; the review window holds screenshots, apps and prompts.

## Tests

- Handlers per role: what owner, worker, mixed and viewer each see.
- World generators: counts per world, timeline relative to today, determinism for a given day and seed.
- `packages/statistics-core` from both the API and the mock.
- A plain `build` contains no `msw`.

## Delivery

Branch `feat/0-demo-mode`, cut from `feat/0-dashboard-split`; a PR to `dev` once the dashboard PR has merged.
