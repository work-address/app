import { routes } from '@/routes'

export type InvoiceActionsLayout = 'desktop' | 'mobile'
export type InvoiceShareResult = 'shared' | 'copied' | 'cancelled'

type ShareData = { url: string; title: string }
type SharePorts = {
  share?: (data: ShareData) => Promise<void>
  copy: (url: string) => Promise<void>
}

/** Stable record URL, independent of the current page query or fragment. */
export function getInvoicePageUrl(origin: string, invoiceId: string): string {
  return new URL(routes.invoice.build({ id: invoiceId }), origin).toString()
}

/** Native cancellation is quiet; unsupported/failed native share can copy. */
export async function shareInvoiceLink(
  data: ShareData,
  ports: SharePorts,
): Promise<InvoiceShareResult> {
  if (ports.share) {
    try {
      await ports.share(data)
      return 'shared'
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        return 'cancelled'
      }
    }
  }

  await ports.copy(data.url)
  return 'copied'
}
