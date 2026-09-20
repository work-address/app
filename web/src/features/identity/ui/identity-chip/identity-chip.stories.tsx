import styled from 'styled-components'

import { IdentityChip } from './identity-chip'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'features/identity/IdentityChip',
  component: IdentityChip,
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  args: { state: 'current', version: 2 },
} satisfies Meta<typeof IdentityChip>

export default meta

type Story = StoryObj<typeof meta>

/** data-state="current": the registry holds this version as the current one. */
export const Current: Story = {}

/** data-state="superseded": a newer version has been published since. */
export const Superseded: Story = { args: { state: 'superseded' } }

/** data-state="withdrawn": the holder retired the record on chain. */
export const Withdrawn: Story = { args: { state: 'withdrawn' } }

/** data-state="mismatch": the registry does not hold this commitment. */
export const Mismatch: Story = { args: { state: 'mismatch' } }

/** data-state="unverified": the chain could not be read - not a failed proof. */
export const Unverified: Story = {
  args: { state: 'unverified', version: null },
}

/** Nothing anchored: the chip renders nothing rather than announcing an absence. */
export const NothingAnchored: Story = { args: { state: 'none' } }

const Frame = styled.div`
  display: grid;
  justify-content: start;
  padding: 8px;
`
