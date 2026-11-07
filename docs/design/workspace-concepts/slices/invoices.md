# Invoices: list first, record presentation separately

Preview: [invoices.html](../previews/invoices.html).
Routes: list `/invoice`; record `/invoice/:id`. `/invoices` is a compatibility redirect.
Read the [handoff](../../../claude-handoff-time-workspace.md) and
[invoice lifecycle](../../../invoice-lifecycle.md).

## Units

| Unit | Files under `web/src/` | Finish condition |
| --- | --- | --- |
| I1 — list and totals | `pages/invoices.tsx`, `features/invoice/ui/invoices-table.tsx`, `invoice-filters.tsx` | Summary, filter toolbar, flat rows, status, amount, and responsive cards match the reference while retaining full filtering/sorting/pagination and separate summary/list request states. |
| I2 — record | `pages/invoice.tsx`, `features/invoice/ui/invoice-overview.tsx`, `invoice-lines.tsx`, `invoice-section.tsx`, `invoice-time.tsx` | Existing document route uses white sheets and clear totals; line items, worklogs, print/export, and actual invoice actions remain complete. |

The current list already uses `WorkspacePage`, `WorkspaceSummary`, metrics, and
`WorkspacePanel`. Inspect before editing. The preview modal is a hierarchy reference
for I2; it does not replace the real document route with a simplified modal.

## Preserve these contracts

- Use server-backed `$invoiceSummary` and amount-in-cents helpers. Do not sum the
  visible page of invoices to produce overall totals, or copy the sample $80 rate.
- Keep project/status/period/amount filters and all sort fields. Status tabs may
  restyle the existing filter only if all supported states remain reachable.
  The preview shows Paid/Awaiting examples; real rejected or other states remain.
- Preserve `canSettleInvoice`, current-user roles, pending disabling, and the real
  settlement/rejection actions. The mock's reversible toggles do not define the
  production state machine, permissions, or effect on worklogs.
- Show the issuer, work period, issue date, payment date when present, rate, and
  amount. Preserve frozen invoice-line rates and existing legacy fallbacks.
- Retain error versus empty distinctions, summary retry, filters with zero
  results, infinite loading, and retained rows on later request failure.
- Preserve invoice details, line/worklog paging and sorting, share/print/download
  behavior, and the route's access rules.

Relevant tests are under `features/invoice/model/` and `features/invoice/lib/`:
feed/filter/sort, queries, settlement, rejection, actions, and worklog paging.
Choose the tests matching the changed behavior. Include phone list and desktop
record evidence; check print layout if I2 touches document geometry.
