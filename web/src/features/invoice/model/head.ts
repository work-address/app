/** What the invoice page puts in the tab and the link preview. */
export type InvoiceHead = {
  title: string
  description: string
}

type Translate = (key: string, params?: Record<string, unknown>) => string

type InvoiceHeadInput = {
  /** The project the invoice bills, if it has loaded. */
  project?: string | null
  /** The amount, already formatted for display. */
  amount?: string | null
  isPaid?: boolean
  failure?: 'not-found' | 'failed' | null
}

/**
 * The tab names the invoice by its project, so several open invoices can be
 * told apart, and the description says what can be done with it. Before the
 * record arrives - or when it never will - the title falls back to the
 * generic one rather than reading "undefined invoice".
 */
export function buildInvoiceHead(
  { project, amount, isPaid = false, failure = null }: InvoiceHeadInput,
  t: Translate,
): InvoiceHead {
  if (failure === 'not-found') {
    return {
      title: t('invoice.notFound.documentTitle'),
      description: t('invoice.page.metaGeneric'),
    }
  }

  if (!project) {
    return {
      title: t('app.documentTitle.invoice'),
      description: t('invoice.page.metaGeneric'),
    }
  }

  return {
    title: t('invoice.page.documentTitle', { project }),
    description: t('invoice.page.meta', {
      project,
      amount: amount ?? '',
      state: t(isPaid ? 'invoice.state.paid' : 'invoice.state.requested'),
    }),
  }
}
