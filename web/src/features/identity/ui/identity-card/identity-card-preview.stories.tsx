import styled from 'styled-components'

import { identityPreview } from '../../model/identity-slots'

import { IdentityCardPreview } from './identity-card-preview'

import type { AppPublicUser } from '@/shared/vendor/identity'
import type { Meta, StoryObj } from '@storybook/react-vite'

const FILLED: AppPublicUser = {
  name: 'Grace Hopper',
  title: 'Rear Admiral',
  company: 'UNIVAC',
  bio: 'Compilers, and the case for writing them.',
  rate: '200.00',
  skills: 'COBOL,Compilers,Standards',
  city: 'New York',
  country: 'US',
  linkedIn: 'grace-hopper',
}

type HarnessProps = { user: AppPublicUser }

const Harness = ({ user }: HarnessProps) => (
  <Frame>
    <IdentityCardPreview preview={identityPreview(user)} />
  </Frame>
)

const meta = {
  title: 'features/identity/IdentityCardPreview',
  component: Harness,
  args: { user: FILLED },
} satisfies Meta<typeof Harness>

export default meta

type Story = StoryObj<typeof meta>

/** data-state="committed": every slot the profile fills. */
export const Committed: Story = {}

/** data-state="empty": the slots are there, and hold fillers nobody can open. */
export const EmptySlots: Story = {
  args: { user: { name: 'Grace Hopper' } },
}

/** data-state="unusable": a column schema v1 has no canonical form for. */
export const UnusableColumn: Story = {
  args: { user: { ...FILLED, country: 'United States' } },
}

/** Nothing at all: the card says so rather than offering an empty publish. */
export const NothingToCommit: Story = {
  args: { user: {} },
}

const Frame = styled.div`
  display: grid;
  max-width: 710px;
  padding: 8px;
`
