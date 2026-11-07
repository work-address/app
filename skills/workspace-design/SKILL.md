---
name: workspace-design
description: Apply the Address Work workspace design to web pages and components, maintain its shared design tokens, or review visual consistency against the dashboard. Use for styling, layout, responsive behavior, and design-system adoption in this repository.
---

# Workspace design

Build the Address Work interface with the approved workspace design: a pale blue
canvas, white reading surfaces, navy headings, readable supporting text, soft
blue shadows, and restrained blue controls. Preserve the user's requested page
scope and the application's real data and behavior.

This is the authoritative design playbook. Treat the dashboard as the working
reference, including its latest changes: filters at the top right, Projects at
half width, text-only project identities, and Create project beside its count.
Those are dashboard composition choices, not a requirement that every page have
the same blocks.

## Sources of truth

| What | Authoritative source |
| --- | --- |
| Design decisions, composition recipes, acceptance criteria | This skill |
| Exact colors, dimensions, typography, motion, chart geometry | [`workspaceDesign`](../../web/src/shared/config/workspace-design.ts) |
| Derived CSS properties, scope and theme mappings | [`WorkspaceDesignStyles`](../../web/src/shared/styles/workspace-design.ts) |
| Reusable page, header, panel, summary and metric components | [`shared/ui/workspace`](../../web/src/shared/ui/workspace/index.ts) |
| Viewport breakpoints | [`theme`](../../web/src/shared/lib/theme.ts) |
| React placement, exports, naming and variants | [`fsd-styled-components`](../fsd-styled-components/SKILL.md) |

Read the token source and the shared component you intend to use before editing.
Numeric values below describe the approved proportions; code is the value
source. Change a shared token once when a design decision changes, then verify
its consumers. Avoid maintaining another palette or token table in page code.

## Delivery workflow

1. **Inspect the real page.** Open the requested route with its supplied filters.
   Read its page component, composed features, current data roles and actions.
   Capture before views and list every visible block. This step is done when
   every block has an identified purpose, data source and primary interaction.
2. **Specify the change.** Name the files, shared components, tokens and responsive
   behavior. For a migration, identify where the workspace scope will start and
   stop. Keep unrelated routes on their current design. This step is done when
   no visual region requires an invented local style system.
3. **Build with shared parts.** Reuse the primitives below, keep application state
   in its existing model, and replace presentation literals with tokens. Extend
   a shared component through its public props or `className`; give recurring
   behavior a shared implementation rather than copying its markup.
4. **Compare at the same size.** Review the live result beside the approved
   dashboard or the supplied reference at an equal viewport width. Compare
   font, hierarchy, padding, gaps, edge alignment, shadows and control heights
   separately. A blue background and rounded cards alone are not completion.
5. **Exercise and measure.** Follow the acceptance section. Fix every observed
   clipping, collision, unreadable label, broken action or scope leak before
   calling the page finished. Use real content; keep meaningful stress cases.
6. **Deliver evidence.** Report the concrete changes, checks and remaining data
   dependencies. Save a screenshot showing the changed region with enough
   surrounding page to judge alignment. State only checks actually performed.

For a small follow-up, use the same sequence at the affected desktop width and
390px; a new page adoption or layout-system change uses all four review widths.

## Applying the design

The whole application uses the workspace design. `WorkspaceDesignStyles` is
installed once by the application, and `data-ui="workspace"` sits on the root
Radix `Theme` in `app/render.tsx`. The same rules also match every Theme Radix
renders into a portal (`.radix-themes[data-is-root-theme='false']`), so dialogs,
drawers, menus, popovers and tooltips share the page's font, colours and
controls without a per-component prop. Keep that single owner: a page or layout
does not set the attribute again.

Use `var(--ui-...)` in CSS. Use `workspaceDesign` for numeric values required by
React, Recharts or Motion. The CSS token map is derived from that same object.
Do not add local color, spacing, radius, font, shadow or motion literals. If an
existing token cannot express an approved recurring role, add that role to the
shared source and derive its CSS property there; do not approximate it per page.
Use the theme's breakpoint helpers for viewport queries and shared numeric
thresholds for container queries: CSS custom properties do not work as query
conditions. Zero, percentages, fractions and content-driven dimensions remain
valid layout expressions.

Shared primitives expose optional `--*` hooks with their former values as
fallbacks (`--button-<size>-*`, `--select-trigger-*`, `--date-field-*`,
`--toolbar-*`, `--sort-select-*`, `--table-*`). `WorkspaceDesignStyles` sets
them inside the scope, together with the Radix field and portal mappings. Change
a control's workspace geometry there, once, rather than per page. A table that
needs different behaviour overrides a hook on its own root, as the invoice
worklogs table does with `--table-sort-offset`.

## Typography

Use the system UI font stack from `--ui-font`; keep heading, body and form-control
families consistent. The old app's Inter stack belongs to unmigrated pages.
Check the rendered family, not just the declaration.

| Role | Approved proportion | Use |
| --- | --- | --- |
| Page title | 40px / 48px, weight 650, tracking −0.03em | One h1 per page |
| Phone page title | 28px / 36px | Below `md` |
| Panel title | 22px / 30px, weight 650, tracking −0.01em | h2 inside a white panel |
| Primary content | 16px / 24px | Names, prompt text, values, primary labels |
| Supporting content | 14px / 20px | Metadata, table headings, hints, chart labels |
| Page description | 18px / 26px; phone 14px / 20px | A short purpose sentence |
| Summary value | Responsive 24–36px, weight 620, tracking −0.025em | Headline metrics |
| Eyebrow | 14px, weight 600, tracking 0.18em, uppercase | Optional page context |

Use the matching `--ui-title-*`, `--ui-heading-*`, `--ui-body-*`, `--ui-meta-*`,
`--ui-description-*`, `--ui-metric-*` and `--ui-eyebrow-*` tokens. The shared
components already apply these roles.

- Names use semibold emphasis; descriptions use regular weight and muted color.
- Body text remains comfortable inside large panels. Shrinking all labels to
  11–12px to make a layout fit recreates the rejected first implementation.
- Numeric columns and durations use tabular numerals. Keep an amount or compact
  duration together; move a label or whole fact to the next line before splitting
  `$2922.17`, `1 PM`, or an hour/minute pair.
- Use existing localized currency/count helpers. Compact durations use
  `formatCompactDurationFromMinutes`; expose the unabbreviated duration with
  `aria-label` when the visual abbreviation replaces a full value.
- Let headings and names wrap where necessary. Clamp only secondary previews,
  such as prompt text, when opening the row exposes the complete content.
- Put new user-facing copy in the existing translation files, including empty
  states, button labels and accessibility text. Do not embed English in styles
  or create presentation-only dates that disagree with the selected period.

## Color and depth

| Token | Role |
| --- | --- |
| `--ui-canvas`, `--ui-glow` | Pale blue workspace background and its gentle glow |
| `--ui-surface` | White primary content surface |
| `--ui-inset` | Quiet inset stats, hover/focus row backgrounds |
| `--ui-ink` | Navy headings, emphasized identities and headline values |
| `--ui-text` | Primary reading text and ordinary values |
| `--ui-muted` | Secondary facts, labels and metadata |
| `--ui-blue` | Primary actions, links, focus, active navigation |
| `--ui-line` | Pale blue separators and control boundaries |
| `--ui-edge` | The subtle outer edge of a raised surface |
| `--ui-shadow` | The shared two-layer blue elevation |
| `--ui-chart-1`…`--ui-chart-8`, `--ui-chart-other` | Chart series and remainder |

Keep the main reading surfaces white. The blue canvas frames the panels; it
should not tint every row or create nested colored boxes. Use state colors for
actual status only. A green “Saved” or “Synced” badge requires a corresponding
application state; a decorative mockup badge does not supply that state.

Use the complete shared shadow. Its two soft layers give the surface depth;
a single negative-spread shadow looked almost flat in the rejected version.
Use the surface edge plus shadow once per card. Use hairline separators inside
it. Hover can tint the row; it does not need another elevated card.

## Spacing and geometry

Use semantic tokens for page and panel geometry, and the shared spacing scale
for local gaps. Prefer `gap` to sibling margin rules; use grid for layout.

| Region | Approved rhythm |
| --- | --- |
| Desktop page | 40px horizontal inset and top inset; 48px bottom |
| Phone page | 16px horizontal inset; 24px top and 40px bottom |
| Between sections or adjacent panels | 24px |
| Panel outer corners | 28px radius |
| Panel header sides/top and content sides/bottom | 28px desktop; 20px phone |
| Panel header to content | 24px desktop; 16px phone |
| Title to description | 4–8px, owned by the shared header |
| Controls and related metadata | 8–12px gaps |
| Standard controls | 40px high, 12px corners |
| Page filter controls | 48px high |
| Pills | Fully rounded, compact internal padding |
| Focus ring | 2px, using shared focus tokens |

Keep a common left content edge for titles, rows and charts. In tables, any extra
cell inset must be applied consistently to the header and corresponding cells.
Use `min-width: 0` on grid children containing names, dates, inputs or charts.
Let adjacent panels stretch to equal height through their parent grid.

A bounded information panel can scroll its body on desktop when the content
exceeds the shared ceiling. Forms and document surfaces need natural height.
On phones, panels grow with their content and the page owns vertical scrolling.
Horizontal scrolling is reserved for a real dense table or heatmap, within its
own region; it must not make the whole page wider.

## Component recipes

Import public components from `@/shared`. Reuse existing `Button`, `IconButton`,
`Select`, `DateRangePicker`, `SearchInput`, `SortSelect`, `Tooltip`, dialogs, loading
and state components rather than rebuilding them with raw HTML.
On adopted pages, the workspace primitives below supply the visual contract;
legacy page wrappers and stat tiles remain defaults for unmigrated pages.

### Page and header

`WorkspacePage` supplies insets, not sibling layout. Extend it with a grid `Root`
and the shared section gap. `WorkspacePageHeader` supplies eyebrow, title,
description and trailing actions. Actions align upper right from `xl` and get
their own row below it. The description uses `--ui-description-measure` (52ch).
A custom date range gets a second filter row rather than crowding the title.

```tsx
<Root>
  <WorkspacePageHeader
    eyebrow={t('page.eyebrow')}
    title={t('page.title')}
    description={t('page.description')}
    actions={<PageFilters />}
  />
  <WorkspacePanel
    title={t('section.title')}
    aside={<SectionActions />}
    toolbar={<SectionFilters />}
  >
    <SectionContent />
  </WorkspacePanel>
</Root>

// At module scope, after the component:
const Root = styled(WorkspacePage)`
  display: grid;
  align-content: start;
  gap: var(--ui-section-gap);
`
```

The named filters, actions and content stand for the page's existing features.
Fetching and mutations stay in their current feature/entity models.

### Panels and actions

Use `WorkspacePanel` for a white information panel with its title inside.
Use `WorkspaceSheet` for a white surface that names itself inside, such as a
form section or a document part. Record pages (an invoice, a profile, the
profile form) keep their heading on the canvas and put their parts on sheets.
Its default is natural height. Set `bounded` only for an intentionally capped
information/list panel; the shared mobile behavior restores natural height.
Group count and primary action in `aside`, not as a second toolbar action.
A count is informational, not a clickable button. On a phone, keep the count
and action together on their own header line when needed; an icon-only action
retains its accessible label and tooltip.

Keep one primary solid action in an action group. Use the shared control height,
corner radius, typography and border tokens for search, sort and segmented
filters. Expose optional styling hooks with existing defaults when extending a
shared primitive; that prevents an isolated page change from restyling others.
Use `toolbar` for persistent search/filter controls above replaceable content.
For search, render `SearchInput` there with `value={query}`, `onChange={queryChanged}`
and a localized `placeholder` and `aria-label` appropriate to the page. The default
placeholder is project-specific. Its clear button calls `onChange('')`; keep the
toolbar visible when filtering produces zero rows, so clearing restores results.

Use `loading`, `failed`, `onRetry` and `empty={{ title, description }}` for request
states. Failure must render even when retry is unavailable; supply `onRetry` when
retry is supported. Distinguish no search matches from an empty collection in the
empty-state copy. Keep header and toolbar stable through loading, failure and
empty results; do not flash empty content while a request is pending.

### Summary metrics

Use `WorkspaceSummary` around `WorkspaceMetric` items. A metric accepts `label`,
`value`, optional `valueLabel` for unabbreviated accessible text, `hint`, and
`loading`. Related metrics share one white surface with light dividers.
The summary defaults to `detail={true}`: five desktop columns, two below `xl`,
and a final odd metric spanning the row. Use `detail={false}` for the one-metric
viewer summary. A new page with another metric count needs an intentional
matching grid; do not copy a divider layout that assumes a different count.

### Status

Use `WorkspaceStatus` for a real state: a pill with its tone's icon
(`positive` check, `attention` clock, `critical` cross, `neutral` none).
Map the domain state to a tone in the feature (as `invoiceStateTone` does);
a control that is both a status and an action, such as the Time payment
toggle, wraps the pill in its own button.

`WorkspaceFreshness` is the page's "Up to date" / "Updating…" pill. Feed it the
page's own request state (pending, failed); it shows nothing after a failure
and never claims that tracking or syncing succeeded. `WorkspaceSummary` takes
`columns` for a strip of two to four metrics, which phones then stack.

### Lists and tables

Use flat rows with pale separators. Put the name first and metadata directly
below it; align numeric columns consistently. Keep a row's click target a
semantic link or button. Put a remove/edit button beside that link, not inside
it. Focus must make the row's action obvious without depending on hover.

Project identities are text-only in the approved dashboard. Agent prompt rows
retain their small agent icon, then name, prompt, metadata, and right-aligned
duration. Identity icons are useful only when they communicate something; they
are not padding substitutes. Preserve filtering, search, sorting and empty-state
creation while relocating controls.

### Charts

Use the shared chart components and blue series tokens. Use solid pale horizontal
grid lines, readable 14px labels, restrained rounded bar ends, and the shared
numeric bar geometry. Keep legend and tooltip colors consistent with the series.
Charts compare real values; do not change the axis, aggregation, or series to
imitate illustrative heights from the concept.

Keep full labels and exact values available in a tooltip when axis labels need
shortening. Preserve keyboard and pointer access to details. A chart's loading
shape should occupy the same plot space as its loaded state. Empty and failed
requests are different states and need different explanations.
Use labels or a legend as well as color to distinguish series and statuses.
Preserve accessible names for charts and icon-only controls, visible keyboard
focus, semantic headings, and the application's existing focus management.

## Dashboard composition reference

- Header: context/title/description left, project/people/period filters top right.
- Summary: one full-width white strip; real period totals and authorized details.
- Desktop grid: 12 columns. Time by project spans 7 and Insights spans 5.
- Projects spans 6 beside App usage at 6. Count and Create project share its
  header; the toolbar below keeps status filters, search and sorting.
- Agents and Recent prompts each span 6. Team and screenshots use full rows.
- Below `xl`, sections become one column; below `md`, table rows become readable
  stacked groups with all authorized figures retained.
- Human tracked time and assisted/autonomous agent time remain distinct. Viewer
  role restrictions apply to the data rendered, not merely its CSS visibility.
- Long project names and real rates take the place of the concept's illustrative
  project descriptions. Keep actual project dialogs and prompt review actions.

## Verification and acceptance

For page adoption, compare before/after at **390, 1280, 1440 and 1920px**. Include
the whole relevant page by scrolling its actual content container; a viewport
screenshot does not prove that lower panels fit. Save enough views to cover all
changed regions. Use the supported browser tool in the current environment.

Measure with read-only DOM inspection after content and fonts have rendered:

- The document width equals the viewport width; no page-level horizontal scroll.
- Header actions and the rightmost panel end on the same content boundary.
- Adjacent panel tops/bottoms agree within 1px; intended gaps match the token.
- Computed font family, size, weight, line height and tracking match their roles.
- Panel padding, border radius, background and complete shadow match tokens.
- Names, headers, money and dates do not collide, break mid-number, or disappear.
- Phone content is not cut off inside a fixed-height card. An intentionally
  bounded desktop list has an accessible, usable scrolling body.

Exercise the changed paths: filters, custom dates, sorting, a row's details,
primary action and cancel/close. Check keyboard focus and Escape where supported.
Review loading, empty and retryable error states relevant to the change. Use an
owner and a restricted role when permissions affect the content. Check a long
supported translation when changing text or control width. Preserve reduced
motion for reveal/hover behavior; use shared motion constants rather than local
animation timings.

Run from `web/`:

```sh
pnpm exec tsc -b
pnpm exec eslint <changed-source-files>
pnpm test -- <relevant-unit-test-files>
```

Run tests for affected behavior, not assertions that duplicate CSS constants.
Avoid running the repository-root API suite during a seeded browser review; it
can disturb the demo database. Lint only touched files when using `--fix`.
If hot reload leaves transient demo data or stale animation, reload once after
edits and verify a clean load before diagnosing it as a product regression.

Finally, after a shared styling change, recheck every route that renders the
changed primitive (Dashboard, Time, Invoices, an invoice, a profile, the profile
form, sign-in and connect) and at least one portal. Check console errors on a
clean load. Passing TypeScript does not substitute for this visual review.
The task is complete when the requested page matches the intended hierarchy,
all affected interactions work, and every applicable check above has evidence.
