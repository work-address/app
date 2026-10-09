import { createEffect } from 'effector'

import { shareInvoiceLink } from './invoice-actions'

import { copyToClipboard } from '@/shared'

export const shareInvoiceFx = createEffect(
  async (data: { url: string; title: string }) => {
    return shareInvoiceLink(data, {
      share:
        typeof navigator.share === 'function'
          ? (payload) => navigator.share(payload)
          : undefined,
      copy: copyToClipboard,
    })
  },
)

/** Preserve the existing browser PDF/print workflow and print stylesheet. */
export const saveInvoicePdfFx = createEffect(() => window.print())
