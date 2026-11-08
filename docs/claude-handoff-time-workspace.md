# Claude handoff: workspace UI, Time first

Updated **2026-11-07**. Start with the current checkout; this file keeps its
original name so existing handoff links continue to work.

## Assignment and scope

The user requested the dashboard's style across the app and explicitly chose
**Finish Time first**. They subsequently requested concepts for Dashboard, Time,
Invoices, Profile, Settings, and Sign-in, then asked to save those concepts in this repo
and prepare bounded implementation work for a cheaper model.

**Default next implementation assignment: Time, starting with T1.** Finish and
review Time before starting another page unless the user assigns a different
slice. The other briefs are prepared references, not a claim that their app
implementations are complete. This handoff update itself changes documentation
and concept assets only; it does not implement or commit application changes.

## Current checkout — inspect before editing

The original inventory below was recorded on `fea/0-ui-theme` at `ef5243ce`.
Since then, `434e492e` applied the workspace design across the app and `e58721c4`
built concepts into Time, Invoices, Profile, and Settings. Additional uncommitted
changes are present. Treat the bullets below as historical context, and inspect
current routes/components and their diffs before selecting a remaining gap.
Preserve ongoing work; do not restart from the earlier committed baseline.

Source facts from the original inventory, not a completed visual review:

- `web/src/app/render.tsx` installs `WorkspaceDesignStyles` under the root
  `<Theme data-ui="workspace">`. The current style adapter also handles portals.
  The old Dashboard-only layout opt-in instruction is obsolete.
- Time already uses `WorkspacePage`, `WorkspacePageHeader`, and `WorkspacePanel`.
  Its current phone List uses `TimeTableStack`; Grid and the shared dialog remain.
- `pages/invoices.tsx` already uses workspace summary/panel primitives and
  server-backed invoice totals. The list route is `/invoice`.
- Profile, profile edit, wallet cards, and shared sheets already have working-tree
  edits. Settings is a concept name; the real editor is `/profile/:id/edit`.
- New files already present include Time stack rows, payment/screenshot cells,
  the select-all helper/test, empty state, and `WorkspaceSheet`.

The earlier statements “working tree clean” and “no Time implementation changes”
are no longer true. Re-evaluate remaining gaps instead of restarting the migration.
App tests and full visual acceptance were not run as part of saving these concepts.

## Read only what the assigned unit needs

1. Read [the concept catalog](design/workspace-concepts/README.md), including its
   **concept-to-product differences**, before translating mockup content into UI.
2. Read [workspace-design](../skills/workspace-design/SKILL.md) for the visual
   contract, [FSD/styled-components](../skills/fsd-styled-components/SKILL.md) for
   the implementation spec and structure, and
   [web-effector](../skills/web-effector/SKILL.md) before touching React/models.
   Use [polish-page](../skills/polish-page/SKILL.md) for the final page review.
3. Read [shared tokens](../web/src/shared/config/workspace-design.ts),
   [CSS adapter](../web/src/shared/styles/workspace-design.ts), and only the
   [workspace components](../web/src/shared/ui/workspace/index.ts) being changed.
4. Open the assigned preview and current live route, then read its brief below.
   Other page briefs can stay out of context until assigned.

## Saved concepts and work queue

All previews and their source fragments are inside
`docs/design/workspace-concepts/`; no conversation attachment or home-directory
file is required to inspect them.

| Page | Preview | Brief / units | Default order |
| --- | --- | --- | --- |
| Time | [Open](design/workspace-concepts/previews/time.html) | [T1 composition/filters; T2 List/Grid; T3 details/bulk](design/workspace-concepts/slices/time.md) | Active, finish first |
| Invoices | [Open](design/workspace-concepts/previews/invoices.html) | [I1 list; I2 record](design/workspace-concepts/slices/invoices.md) | Later page assignment |
| Profile | [Open](design/workspace-concepts/previews/profile.html) | [P1 identity; P2 content/share](design/workspace-concepts/slices/profile.md) | Later page assignment |
| Settings | [Open](design/workspace-concepts/previews/settings.html) | [S1 details; S2 links; S3 wallet presentation](design/workspace-concepts/slices/settings.md) | Later page assignment |
| Dashboard | [Open](design/workspace-concepts/previews/dashboard.html) | [D1 header/charts; D2 projects/prompts; D3 supporting panels](design/workspace-concepts/slices/dashboard.md) | Reference; refine when assigned |
| Sign-in | [Open](design/workspace-concepts/previews/sign-in.html) | [A1 composition/choices; A2 step and request states](design/workspace-concepts/slices/sign-in.md) | Saved concept; implement when assigned |

The original fragments are preserved exactly under `sources/`; the
[manifest](design/workspace-concepts/manifest.json) records hashes and all
preview entry states. Generated HTML preserves its sandboxed iframe and CSP.
Use the catalog's local-server command if the browser needs HTTP. Network access
is required for the preview runtime/icons and the dashboard chart library.

## Implementation process for a smaller model

1. **Inventory the assigned unit.** Read the target diff, open the current route,
   and list the visible gaps against the preview. Identify existing data/action
   owners. Done when every proposed change has a file and a real data source.
   If the unit already matches, record verification instead of rewriting it.
2. **Write a short spec.** State the selected unit ID, files, shared components,
   tokens, desktop/phone behavior, and preserved interactions. Done when no
   visible region depends on copying a local mockup style system or inventing
   an API. Record missing data/capabilities as follow-up work.
3. **Implement that unit.** Reuse the current React/Effector architecture and
   public barrels. Use role-based styled-component names and `data-*` variants.
   Keep changes local to the named feature; a recurring missing style role may
   be added once to shared tokens with its consumers reviewed.
4. **Verify the unit.** Meet its page brief's finish condition and the checks
   below. Fix observed defects. Report exact evidence and unresolved gaps.
5. **Handoff the next unit.** Name completed and remaining units. For a whole
   Time assignment, proceed through the remaining Time units and final review;
   for a single-unit assignment, deliver that bounded result.

A concept's layout is a reference, not a backend specification. In particular,
preserve real filters, permissions, pagination, payment state machines, rich-text
handling, form validation, and wallet controls even where the mock is simpler.
The catalog and page briefs identify the risky mismatches explicitly.

## Shared visual contract

The authoritative rules live in the workspace-design skill; do not create a
parallel palette or copy the prototypes' `--ti-*` / `--pc-*` / `--aw-*` values into page code.
The compact preview font sizes are not the production type scale. Use the
existing `--ui-*` roles for legible app text, panel geometry, and control heights.

Compare at equal viewport widths: font family/size/weight/leading, content insets,
section gaps, aligned edges, corner radii, full shadows, and control heights.
The user rejected earlier passes that matched blue colors but missed these details.
Main reading surfaces remain white. Green saved/synced badges require real state.

Retain the explicit Dashboard decisions when working there: filters at top right,
Projects half width, no decorative project-item icons, and Create beside the count.
They are not a requirement to copy Dashboard's blocks onto every page.

Shared styling now applies globally. Changing the adapter, primitive, or portal
mapping requires checking its other consumers; adding another route-level
workspace scope is not the migration strategy.

## Verification and delivery

- Reuse the running demo if available at `http://localhost:8000`; inspect its
  state before starting or reseeding anything. See [demo-mode](demo-mode.md).
- For a completed page, review **390, 1280, 1440, and 1920px**, including lower
  content in the real scroll container. A small follow-up can first use the
  affected desktop width and 390px, then join the page's final review.
- Measure document overflow, fonts, panel padding/radius/shadow, edge alignment,
  and control geometry. Exercise long names, notes, dates, money, and a long
  supported translation. Keep full information/actions reachable on phones.
- Exercise the assigned unit's filters, sorting, views, details, close/cancel,
  keyboard focus, and relevant loading/empty/error/restricted-role states.
  Real payment/profile/wallet controls are not preview-only simulations.
- Run TypeScript and lint touched source files from `web/`; run relevant existing
  behavioral tests named by the page brief. Add tests for changed behavior, not
  assertions that duplicate styling constants.

```sh
cd web
pnpm exec tsc -b
pnpm exec eslint <changed-source-files>
pnpm test -- <relevant-test-files>
```

The repo-root test script runs the API suite and may disturb seeded demo data;
run frontend checks from `web/`. Limit formatting to touched files. After a
shared-style change, recheck Dashboard, Time, invoice list/record, profile/editor,
sign-in/connect, and at least one portal. Check console errors after a clean load.

Deliver: completed unit IDs; files changed; screenshots covering desktop and phone;
checks actually run; remaining gaps/data dependencies; next recommended unit.
The generated concept previews are references, not evidence of app acceptance.
Preserve unrelated working-tree edits and commit only when explicitly requested.

## Ready-to-use task prompt

> Read `docs/claude-handoff-time-workspace.md`, the concept catalog, and the Time
> brief. Implement **T1 only** against the current working tree. First report the
> observed gaps and a short file/component/token spec, then finish the unit and
> verify its criteria. Preserve the existing models, filters, other pending work,
> and all application behavior. Deliver desktop/phone evidence, checks, and the
> remaining Time units. If T1 is already complete, provide evidence instead of
> rewriting it. Do not start another page or commit.

Replace **T1** and its page brief with an explicitly assigned unit from the table
for later tasks. A whole-Time task can name **T1–T3 plus final Time review**.
