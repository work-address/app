import type { baseApi } from '@/shared'

export type InvoiceFilter = { projectId?: string; state?: 'PAID' | 'Requested' }
export type InvoiceSettlement = baseApi.InvoiceSearch & {
  id: string
  state: 'PAID' | 'Requested'
}

export const readInvoiceSettlement = (
  id: string,
  invoice: baseApi.InvoiceSearch,
): InvoiceSettlement => {
  if (
    invoice?.id !== id ||
    (invoice.state !== 'PAID' && invoice.state !== 'Requested')
  ) {
    throw new Error('The server returned an invalid invoice settlement')
  }
  return {
    ...invoice,
    id,
    state: invoice.state,
    paidAt: invoice.paidAt ?? undefined,
  }
}

export const matchesInvoiceFilter = (
  invoice: baseApi.InvoiceSearch,
  filter: InvoiceFilter,
) =>
  (!filter.projectId || invoice.project?.id === filter.projectId) &&
  (!filter.state || invoice.state === filter.state)

export const applyInvoiceSettlement = (
  items: baseApi.InvoiceSearch[],
  invoice: InvoiceSettlement,
  filter: InvoiceFilter,
) =>
  items.flatMap((item) =>
    item.id === invoice.id
      ? matchesInvoiceFilter(invoice, filter)
        ? [{ ...item, ...invoice }]
        : []
      : [item],
  )

/** Reload the already-loaded prefix before offset pagination resumes. */
export const readLoadedInvoicePages = async (
  fetchPage: (
    page: number,
  ) => Promise<{ items: baseApi.InvoiceSearch[]; total: number }>,
  throughPage: number,
  pageSize: number,
): Promise<{ items: baseApi.InvoiceSearch[]; total: number; page: number }> => {
  if (
    !Number.isSafeInteger(throughPage) ||
    throughPage < 0 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1
  ) {
    throw new Error('The invoice page span is invalid')
  }
  const byId = new Map<string, baseApi.InvoiceSearch>()
  let expectedTotal: number | undefined
  let page = 0
  while (page <= throughPage) {
    const { items, total } = await fetchPage(page)
    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      (expectedTotal !== undefined && total !== expectedTotal)
    ) {
      throw new Error('The invoice feed changed while it was being read; retry')
    }
    expectedTotal = total
    const previousSize = byId.size
    for (const item of items) {
      if (!item.id) {
        throw new Error('The invoice feed returned an item without an id')
      }
      byId.set(item.id, item)
    }
    const prefixSize = Math.min(total, (throughPage + 1) * pageSize)
    if (byId.size === prefixSize) {
      return {
        items: [...byId.values()],
        total,
        page: Math.max(0, Math.ceil(byId.size / pageSize) - 1),
      }
    }
    if (byId.size > prefixSize || byId.size === previousSize) {
      throw new Error('The invoice feed could not refill its loaded pages')
    }
    page += 1
  }
  throw new Error('The invoice feed could not refill its loaded pages')
}
