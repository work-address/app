# Dashboard design implementation

The single design rulebook is [Workspace design](../skills/workspace-design/SKILL.md).
It defines the visual roles, component recipes, responsive decisions, and acceptance
checks for applying this UI elsewhere. This file records dashboard wiring only.

## Shared implementation

- `web/src/shared/config/workspace-design.ts`: canonical `workspaceDesign` values
  for colors, typography, spacing, surfaces, controls, focus, charts and motion.
- `web/src/shared/styles/workspace-design.ts`: `WorkspaceDesignStyles` derives
  `--ui-*` CSS properties and the opt-in `data-ui="workspace"` theme mapping.
- `web/src/shared/ui/workspace/`: `WorkspacePage`, `WorkspacePageHeader`,
  `WorkspacePanel`, `WorkspaceSummary`, and `WorkspaceMetric`, exported through
  `@/shared`. These primitives have no dashboard queries or domain imports.
- `shared/lib/theme.ts` remains the viewport breakpoint authority. Container
  thresholds and presentation-only chart numbers live in `workspaceDesign`.

## Dashboard composition

`PublicLayout` applies `data-ui="workspace"` only on the dashboard route. Other
routes keep their current theme until their migration is explicitly requested.
The page uses WorkspacePage and WorkspacePageHeader with its filters at the upper
right. Custom dates occupy a second row inside the filter group. Phones stack
header content and controls.

The summary is a WorkspaceSummary containing WorkspaceMetric children. Existing
`data-detail` is presence-only and controls the authorized metric layout. The
DashboardWidget compatibility wrapper uses WorkspacePanel with `bounded` enabled;
`data-bounded` is presence-only and limits long desktop widgets. Phones use natural
card heights and page scrolling.

The first row contains Time by project and insights. Projects stays half-width
beside App usage. Its text-only project rows retain status, rate, authorized
metrics, keyboard activation, and existing detail popovers. Count and Create
project stay together in its card header. `ProjectsTable.showCreateAction` defaults
to true; the dashboard passes false and reuses the page's existing create dialog.
The table's empty-state create action remains available. Agents and Recent prompts
stay paired; Team and screenshots retain their existing conditions and full rows.

## Contracts and boundaries

No fetching, authorization, domain calculations, or backend behavior changes.
Human, assisted, and autonomous time retain their current semantics. Data and
loading/error/empty states come from the existing stores and queries. Existing
`data-overview`, `data-custom`, `data-wide`, `data-viewer`, and `data-detail` variants
remain presence-only. WorkspacePanel adds the optional bounded presentation.
Shared components import only shared modules; feature consumers use public barrels.

## Verification

Compare computed typography, insets, gutters, shadows, panel dimensions, and
responsive behavior before and after extraction. Check the header filters with
preset and custom dates, project dialog and creation, project/prompt rows, chart
tooltips, and a legacy route. Run TypeScript, lint touched files, and the relevant
existing unit tests. The design skill is validated independently with a realistic
page migration request before calling the handoff complete.
