---
name: polish-app
description: Polish the whole web/ app page by page until every screen is finished, dense, consistent with the others, and ready to market. Use when the user invokes /polish-app, or asks for an app-wide polish, consistency or launch-readiness pass across many pages.
---

# Polish the app

The app-wide counterpart of [polish-page](../polish-page/SKILL.md), which takes one page
or a short list of them. Every page still gets the full polish-page pass; this skill adds
what a handful of pages cannot see: the inventory of every screen, drift between pages,
fixes that belong in the shared layer, and the order to work in.

An argument limits the pass to the pages or areas it names (route names from
`web/src/routes/index.ts`, paths, or areas such as "invoices" or "signed-in pages"). With
no argument the target is every page.

Work in rounds. Stop after the audit and let the user confirm the order, unless they
asked to go straight through. Do not commit until the user asks.

## Inventory

- Read `skills/polish-page/SKILL.md`; its rules, local setup and pitfalls apply to every
  page here. Read `skills/fsd-styled-components/SKILL.md`, and `skills/web-effector/SKILL.md`
  if state changes.
- List every screen from `web/src/routes/index.ts` and the router in
  `web/src/app/app.tsx`, which places each page in `AuthLayout`, `PublicLayout` or
  `MainLayout`. Count formats, not just paths: the dashboard with and without projects,
  its time, project and create-project dialogs on a desktop and as a phone drawer
  (`AdaptiveDialog`); the invoice list and an invoice, including a stale or malformed id;
  a profile that is your own, someone else's, an address nobody has signed in with, and
  seen by a guest; the profile editor; sign-in with its local-wallet dialog, and connect,
  each with and without `?nonce=`; and the not-found page. Skip the redirects
  (`/invoices`, `/download`) and the external links (docs and social profiles).
- Keep a ledger in the scratchpad with one row per format: route, page file, feature
  slices, last polish commit, and status. Run
  `git log --oneline -- web/src/pages/<page>.tsx web/src/features/<slice>` to find the last
  polish commit; a `feat(web): polish …` subject means the page has had a pass already.
- Run the app locally as polish-page describes and capture every format, full length, at
  1440×900 and 390×844, signed in and, where the layout allows it, as a guest. Name files
  `<route>-<format>-<width>-<viewer>.png` so the before and after shots pair up. Build a
  contact sheet of every page side by side, because drift between pages only shows
  there.

## Audit across pages

1. **Columns.** Data pages (dashboard, invoices) use `Wrapper width="full"` and
   `ListPageLayout`; one record or a form (an invoice, a profile, the editor) uses
   `Wrapper width="document"`. The first line of every page starts at the same height,
   the side column sits in the same place and collapses at the same width, and switching
   pages in the header does not jump.
2. **Headers.** Every page opens with `PageHeader`, or `PageTitle` alone when the title
   sits inside the page's own card, with the same title size, badge, description and
   trailing actions.
3. **Blocks.** Every section heading is a `SectionTitle`, every summary strip a
   `StatStrip` of `StatTile`s, every search box the shared `Search`, and every dialog an
   `AdaptiveDialog` (or `Modal`/`Drawer` where the phone needs something else).
4. **One look per thing.** A project, a time entry, an invoice, a person or a wallet
   address looks the same on every page, with the same facts and the same CTA wording.
   List each entity's renderings across pages, then fold the duplicates into `entities/*`
   or `shared/ui`.
5. **States.** Every page has a `Skeleton` in its own shape (never a bare spinner), a
   retryable `LoadFailure` that tells "not found" from "failed" (`getLoadFailureKind`,
   `isRecordId`), and an empty `StateNotice` that offers a way on. Pages in
   `PublicLayout` also work for a guest.
6. **Page heads.** Every page renders `PageHelmet`, and every page about one record
   builds its head in a tested `model/head.ts` builder. Tabs read
   `<what is on screen> - Address Work` (`formatPageTitle`). Everything behind sign-in, a
   person's own records and every form are `noindex`, and each description says what a
   visitor can do there.
7. **Copy.** Pages share one plain voice. The same action uses the same verb everywhere,
   and every string exists in all five locales.
8. **Controls.** A bar uses one `Button` size, related actions sit together, and each
   area has at most one `solid` button.
9. **Motion.** Blocks reveal the same way on every page, through `motion/react`, and
   nothing snaps.
10. **Navigation.** Every page is reachable from the header menus or a link, and no state
    is a dead end. Back returns to where the visitor came from.

Sweep the code from `web/`. Each hit is a candidate to judge, not an automatic fix:

```sh
rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\(' src --glob '*.{ts,tsx}' --glob '!src/shared/api/generated/**' --glob '!**/*.stories.tsx'
rg -ln 'styled\.(button|input|textarea|select)\b|<(button|input|select|textarea)([\s/>]|$)' src --glob '!src/shared/**'
rg -n "(to|href)=['\"]/|navigate\(['\"\`]/" src --glob '!src/routes/**'
rg -n 'document\.title|<Helmet\b' src --glob '!src/shared/ui/page-helmet.tsx'
rg -n 'SpinnerRing' src --glob '!src/shared/**'
rg -ln '^const (Empty|Failure|Notice|Badge|Tag|Chip|Divider|Title|Header|Stat) = styled' src --glob '!src/shared/**'
```

## Plan

Rank the findings by where the fix lands:

1. **Shared layer first.** A fix in `shared/ui`, `shared/styles`, a layout, the header
   widget or an entity's UI reaches every page at once. When a pattern repeats on two or
   more pages, promote it to the shared component rather than polishing each copy.
2. **Then pages, in the order a new visitor meets them:** Sign-in and Connect; Dashboard;
   Invoices and an invoice; Profile and the profile editor; Not found.
3. **Recently polished pages last,** unless the audit found drift in them.

Present the inventory with each page's status, the cross-page findings grouped by where
each fix lands, the order, and anything that needs a product decision or backend work.

## Rounds

- **Round one is the shared fixes.** After each one, find every importer of what
  changed and recapture those pages. A shared change is not done until every page that
  uses it has been checked.
- **Each later round covers one page,** or a few that share a feature slice, with the
  full polish-page pass: before changing anything, layout, components and code, finish,
  and verify. Keep each page's changes inside its page file and slice, plus the shared
  fixes it needs.
- **After each round,** update the ledger and re-run the cross-page measurements on the
  pages it touched.
- **Edit in sequence.** The worktree is shared, and other sessions may be editing it, so
  preserve their work. Parallel agents may only do read-only work: captures, sweeps of a
  slice, a page's audit. Never let two agents edit at once.

## Verify across the app

- Measure, don't eyeball. One browser script, run over every route at 1440 and 390,
  collects the `PageTitle`'s size and weight, the header's height, the x and width of
  the content column and the side column, the `SectionTitle` size, and the gaps between
  cards. Every value should agree across pages, and an outlier is a finding.
- On every route, check `document.title`, the description, the canonical and robots
  against the rules above. The console should show no errors, and no `/api` request
  should fail.
- Walk the header navigation at 1440 and 390. Open each dashboard dialog on a desktop
  and as a phone drawer. As a guest, open a profile and an unknown path, and confirm a
  signed-in-only route lands on sign-in.
- From `web/`, run `npx tsc -b`, `pnpm lint` (read-only `eslint .`), the full unit suite
  with `pnpm test` (a shared change touches everything) and `pnpm build`. When a
  `shared/ui` component changes, open its stories. Take the screenshots before any API
  test run, since that can wipe the seeded user.
- Report the ledger as a table (page, status, what changed and why), before and after
  contact sheets, the cross-page measurements, the remaining backend or data
  dependencies and product decisions, and any page the pass did not reach.

## Commits

Commit only when the user asks. Then make one commit per shared change and one per page,
titled `feat(web): polish the <page>`, with a body of short paragraphs, one per block or
problem, saying what was wrong and what it does now, as in `d1a908d0` and `6621bc19`.
Stage only this session's hunks.

## Repository pitfalls

- Everything under polish-page's pitfalls still applies.
- Some blocks were removed on purpose. Check `git log -S` for a block that looks missing
  before restoring it.
- Demo data comes from `seed:demo` in `api/`. Never paste real people's details or slice
  an image from a mockup.
- The seed changes the user id, so re-mint tokens after every re-seed, and a token that
  suddenly 401s usually means the user row is gone rather than the token being wrong.
