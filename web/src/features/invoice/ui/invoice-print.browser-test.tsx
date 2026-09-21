import { Theme } from '@radix-ui/themes'
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commands, page } from 'vitest/browser'

import { getInvoiceTimeRows, type ProjectInvoice } from '../model'

import { InvoiceLines } from './invoice-time'
import { InvoiceSheetDesktop } from './invoice-total-amount-desktop'
import { InvoiceSheetMobile } from './invoice-total-amount-mobile'

import '@radix-ui/themes/styles.css'
import '@/app/app.css'
import '@/shared/i18n/i18n'
import { theme } from '@/shared/lib/theme'

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateMedia: (media: 'print' | 'screen') => Promise<void>
  }
}

/**
 * WP-99: the saved PDF is the invoice. It leaves the product as the PDF its
 * issuer sends, so what `@media print` lays out has to carry every fact the
 * invoice's snapshot holds, on paper as narrow as it will be printed on,
 * with nothing pushed past the margin.
 *
 * Widths: 703px is A4 less the page's 12mm margins at 96dpi - where a
 * desktop prints - and 375px is the phone the mobile layout is drawn for.
 * The print media is switched by the browser provider (the `emulateMedia`
 * command in vite.config.ts), so these are the real print rules, not a
 * simulation of them.
 */
const PRINT_WIDTH = 703
const PHONE_WIDTH = 375

const ISSUER_ID = '5e2d8a1c-9f4b-4a7e-b3c6-8d1f2e9a4b70'
const OWNER_ID = '8f19e321-6669-4928-8f98-1f61d623bfbd'
const ISSUER_ADDRESS = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'
// The longest address the product holds: a raw TON address.
const OWNER_ADDRESS =
  '0:4a5d1e2f3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5'

const LINES = [0, 1, 2].map((index) => ({
  timeId: `17897485-f84c-4dea-9bda-6c185f0f482${index}`,
  fromAt: `2026-09-0${index + 1}T09:00:00.000Z`,
  toAt: `2026-09-0${index + 1}T10:00:00.000Z`,
  minutesActive: 55,
}))

/** A paid hourly invoice with every field filled, as long as it gets. */
const INVOICE: ProjectInvoice = {
  id: '4e61ff62-5642-478f-901b-f7be07550426',
  createdAt: '2026-09-08T10:00:00.000Z',
  fromAt: LINES[0].fromAt,
  toAt: LINES[2].toAt,
  basis: 'HOURLY',
  amountCents: '9075',
  state: 'PAID',
  paidAt: '2026-09-10T12:00:00.000Z',
  settlementKind: 'MANUAL',
  snapshotVersion: 1,
  currency: 'USD',
  issuerAddress: ISSUER_ADDRESS,
  ownerAddress: OWNER_ADDRESS,
  rateHourCents: 3300,
  minutesActive: 165,
  lines: LINES,
  title:
    'Payroll export, reconciliation and the quarterly reporting overhaul for the finance team',
  totalAmount: 90.75,
  user: {
    id: ISSUER_ID,
    name: 'Grace Brewster Murray Hopper, independent contractor',
    address: ISSUER_ADDRESS,
  },
  project: {
    title: 'Payroll export',
    user: {
      id: OWNER_ID,
      name: 'Eckert–Mauchly Computer Corporation (accounts payable)',
      address: OWNER_ADDRESS,
    },
  },
  time: LINES.map((line) => ({
    id: line.timeId,
    fromAt: line.fromAt,
    toAt: line.toAt,
    createdAt: line.fromAt,
    minutesActive: line.minutesActive,
    keyboardKeys: 12_345,
    mouseKeys: 6789,
    mouseDistance: 123_456,
    note: 'Reconciled the ledger export against the bank statement, line by line, and wrote up every discrepancy for the controller',
  })),
  report: {
    rateHour: 33,
    rateTotal: 99,
    minutes: 180,
    minutesActive: 165,
    minutesPaid: 165,
    minutesUnpaid: 0,
    keyboardKeys: 37_035,
    mouseKeys: 20_367,
    mouseDistance: 370_368,
  },
}

/** The fields the document header must print for this invoice. */
const DOCUMENT_FIELDS = [
  'from',
  'billTo',
  'reference',
  'period',
  'currency',
  'amount',
  'status',
  'paidOn',
]

/** The summary's figures: the rate and hours the amount was computed from. */
const SUMMARY_FIELDS = [
  'issueDate',
  'rateHour',
  'timeTotal',
  'timeActive',
  'timePaid',
  'timeUnpaid',
]

type Layout = 'desktop' | 'mobile'

let host: HTMLDivElement
let root: Root

const Sheet = ({
  layout,
  invoice,
  viewerId,
}: {
  layout: Layout
  invoice: ProjectInvoice
  viewerId: string
}) => {
  const SheetLayout =
    layout === 'desktop' ? InvoiceSheetDesktop : InvoiceSheetMobile

  return (
    <Theme>
      <ThemeProvider theme={theme}>
        <main>
          <SheetLayout invoice={invoice} loading={false} viewerId={viewerId} />
          <InvoiceLines rows={getInvoiceTimeRows(invoice)} loading={false} />
        </main>
      </ThemeProvider>
    </Theme>
  )
}

const render = async (
  layout: Layout,
  width: number,
  invoice: ProjectInvoice = INVOICE,
  viewerId: string = ISSUER_ID,
) => {
  await page.viewport(width, 1200)
  host.style.width = `${width}px`
  act(() =>
    root.render(
      <StrictMode>
        <Sheet layout={layout} invoice={invoice} viewerId={viewerId} />
      </StrictMode>,
    ),
  )
}

const textOf = (selector: string): string =>
  (host.querySelector(selector)?.textContent ?? '').trim()

const buttonNamed = (name: string): HTMLButtonElement | undefined =>
  [...host.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === name,
  )

const isShown = (element: Element | undefined): boolean =>
  Boolean(element) &&
  getComputedStyle(element as Element).display !== 'none' &&
  (element as HTMLElement).getClientRects().length > 0

beforeEach(() => {
  document.documentElement.style.overflowX = 'hidden'
  document.body.style.margin = '0'
  host = document.createElement('div')
  host.style.overflowX = 'visible'
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  act(() => root.unmount())
  host.remove()
  await commands.emulateMedia('screen')
})

describe.each([
  ['desktop', PRINT_WIDTH],
  ['mobile', PHONE_WIDTH],
  ['mobile', PRINT_WIDTH],
] as const)('the %s invoice printed at %ipx', (layout, width) => {
  beforeEach(async () => {
    await commands.emulateMedia('print')
    await render(layout, width)
  })

  it('prints every fact the invoice holds', () => {
    for (const field of DOCUMENT_FIELDS) {
      expect(textOf(`dl [data-field='${field}']`), field).not.toBe('')
    }

    expect(textOf("[data-field='from']")).toContain(ISSUER_ADDRESS)
    expect(textOf("[data-field='billTo']")).toContain(OWNER_ADDRESS)
    expect(textOf("[data-field='billTo']")).toContain('Eckert–Mauchly')
    expect(textOf("[data-field='reference']")).toContain(INVOICE.id)
    expect(textOf("[data-field='amount']")).toBe('Amount$90.75')
    expect(textOf("[data-field='currency']")).toContain('USD')
    expect(textOf("[data-field='status']")).toContain('Paid')

    for (const field of SUMMARY_FIELDS) {
      expect(textOf(`[data-field='${field}']`), field).not.toBe('')
    }

    expect(textOf("[data-field='rateHour']")).toContain('$33.00')
  })

  it('prints every billed line', () => {
    const rows = host.querySelectorAll('tbody tr')

    expect(rows).toHaveLength(LINES.length)
    expect(host.textContent).toContain('Reconciled the ledger export')
  })

  it('pushes nothing past the page margin', () => {
    expect(host.scrollWidth).toBeLessThanOrEqual(width)

    for (const element of host.querySelectorAll<HTMLElement>('*')) {
      if (element.getClientRects().length === 0) {
        continue
      }

      expect(
        element.getBoundingClientRect().right,
        `${element.tagName}.${element.className}`,
      ).toBeLessThanOrEqual(width + 1)
    }
  })

  it('leaves the buttons off the paper', () => {
    expect(isShown(buttonNamed('Save PDF'))).toBe(false)
    expect(buttonNamed('Mark as unpaid')).toBeDefined()
    expect(isShown(buttonNamed('Mark as unpaid'))).toBe(false)
  })
})

describe.each([
  ['desktop', 1280],
  ['mobile', PHONE_WIDTH],
] as const)('the %s invoice on screen at %ipx', (layout, width) => {
  it('offers Save PDF, and no link to share', async () => {
    await render(layout, width)

    expect(isShown(buttonNamed('Save PDF'))).toBe(true)
    expect(buttonNamed('Share')).toBeUndefined()
  })

  it('does not scroll the page sideways', async () => {
    await render(layout, width)

    expect(host.scrollWidth).toBeLessThanOrEqual(width)
  })

  /**
   * The payment control is the issuer's: the person owed the money is the
   * one who knows whether it arrived. The owner billed sees the invoice and
   * its state, and can save it, but not certify their own payment.
   */
  it('gives the payment control to the issuer alone', async () => {
    const unpaid = { ...INVOICE, state: 'REQUESTED', paidAt: undefined }

    await render(layout, width, unpaid, ISSUER_ID)
    expect(isShown(buttonNamed('Mark as paid'))).toBe(true)

    await render(layout, width, unpaid, OWNER_ID)
    expect(buttonNamed('Mark as paid')).toBeUndefined()
    expect(isShown(buttonNamed('Save PDF'))).toBe(true)
  })
})
