# Dashboard: match the concept while preserving real blocks

Preview: [dashboard.html](../previews/dashboard.html).
App reference: `/?from=2026-11-01&to=2026-11-07`.
Read the [handoff](../../../claude-handoff-time-workspace.md) first.

The dashboard design system is committed at `ef5243ce`; further shared and
dashboard edits are present in the working tree. This is a refinement slice,
not a replacement with static mockup data.

## Units

| Unit | Files under `web/src/` | Finish condition |
| --- | --- | --- |
| D1 — header, summary, charts | `pages/dashboard.tsx`, `features/dashboard/ui/dashboard-filter-bar/`, existing dashboard chart/summary components | Filters align top right; one white summary surface; chart typography, grid, tooltip, and responsive behavior match shared tokens using real aggregation. |
| D2 — Projects and agent/prompt rows | `features/dashboard/ui/dashboard-projects*`, `dashboard-agents/`, `dashboard-recent-prompts/` | Projects stays half width on desktop, with text identities and Create beside its count; project and prompt rows have deliberate spacing and full details remain accessible. |
| D3 — supporting panels and interaction review | Existing app-usage, Team, screenshot, project-popup components | Real supporting content fits the same hierarchy; dialogs, search/filter, empty states, and restricted-role views remain complete. |

Use actual filenames discovered under `features/dashboard/ui/`; the glob in D2
names the slice, not permission to touch unrelated project screens.

## Design decisions to preserve

- White reading panels on the blue canvas; shared typography, insets, and complete
  two-layer shadows. Compare these individually rather than stopping at colors.
- Projects count and Create share the header. Project identities have no leading
  decorative icons. Keep existing search, status filters, sort, and dialogs.
- Agent rows retain their small identity icon, name, prompt, metadata, and duration.
  Clamp only secondary previews when the full prompt is available on open.
- The concept's Time by day/Desktop session layout is illustrative. Retain the
  live Time by project/Insights/Team/screenshots and role-specific data unless the
  assigned task explicitly requests that composition change.
- Keep human tracked time and assisted/autonomous agent time distinct. Use real
  period/people/project filters, redaction, and rate/payment calculations.
- Use the app's existing chart components and tokens. The preview's CDN chart
  component and local arrays are reference-only.

For model or chart changes, relevant tests live in `features/dashboard/model/`.
The complete unit needs desktop and phone evidence, the applicable shared checks,
and working project/filter/prompt interactions. A global token change also needs
the cross-route regression checks in the handoff.
