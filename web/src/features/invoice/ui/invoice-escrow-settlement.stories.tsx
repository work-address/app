import styled from 'styled-components'

import { invoiceEscrowStubs } from '../__fixtures__/invoice-escrow-stub'

import { InvoiceEscrowSettlement } from './invoice-escrow-settlement'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'features/invoice/InvoiceEscrowSettlement',
  component: InvoiceEscrowSettlement,
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  args: { invoice: invoiceEscrowStubs.released, layout: 'page' },
} satisfies Meta<typeof InvoiceEscrowSettlement>

export default meta

type Story = StoryObj<typeof meta>

/** data-layout="page", released: gross, 5% fee, 95% net, refund, linked tx. */
export const PageReleased: Story = {}

/** data-layout="page", disputed on a chain with no explorer: hash unlinked. */
export const PageDisputed: Story = {
  args: { invoice: invoiceEscrowStubs.disputed },
}

/** data-layout="page", bound but not yet billed on chain: state only. */
export const PagePending: Story = {
  args: { invoice: invoiceEscrowStubs.pending },
}

/** data-layout="page", billed and awaiting release: the bill alone. */
export const PageSubmitted: Story = {
  args: { invoice: invoiceEscrowStubs.submitted },
}

/** data-layout="row": the dense line under an invoice in the list. */
export const RowReleased: Story = {
  args: { layout: 'row' },
}

export const RowExpired: Story = {
  args: { invoice: invoiceEscrowStubs.expired, layout: 'row' },
}

export const RowCancelled: Story = {
  args: { invoice: invoiceEscrowStubs.cancelled, layout: 'row' },
}

const Frame = styled.div`
  display: grid;
  max-width: 960px;
`
