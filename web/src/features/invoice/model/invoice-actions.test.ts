import { describe, expect, it, vi } from 'vitest'

import { getInvoicePageUrl, shareInvoiceLink } from './invoice-actions'

describe('invoice sharing', () => {
  const data = {
    url: 'https://address.work/invoice/invoice-id',
    title: 'Invoice',
  }

  it('QR URLs open the invoice route with no page query or fragment', () => {
    expect(getInvoicePageUrl('https://address.work', 'invoice-id')).toBe(
      data.url,
    )
  })

  it('uses native sharing before copying', async () => {
    const share = vi.fn().mockImplementation(() => Promise.resolve())
    const copy = vi.fn()
    expect(await shareInvoiceLink(data, { share, copy })).toBe('shared')
    expect(share).toHaveBeenCalledWith(data)
    expect(copy).not.toHaveBeenCalled()
  })

  it('does not copy after native share cancellation', async () => {
    const share = vi.fn().mockRejectedValue({ name: 'AbortError' })
    const copy = vi.fn()
    expect(await shareInvoiceLink(data, { share, copy })).toBe('cancelled')
    expect(copy).not.toHaveBeenCalled()
  })

  it('copies when native sharing is unavailable or fails', async () => {
    const copy = vi.fn().mockImplementation(() => Promise.resolve())
    expect(await shareInvoiceLink(data, { copy })).toBe('copied')
    expect(
      await shareInvoiceLink(data, {
        share: vi.fn().mockRejectedValue(new Error('unsupported')),
        copy,
      }),
    ).toBe('copied')
    expect(copy).toHaveBeenCalledTimes(2)
    expect(copy).toHaveBeenCalledWith(data.url)
  })

  it('propagates copy failure for in-page feedback', async () => {
    await expect(
      shareInvoiceLink(data, {
        copy: vi.fn().mockRejectedValue(new Error('clipboard unavailable')),
      }),
    ).rejects.toThrow('clipboard unavailable')
  })
})
