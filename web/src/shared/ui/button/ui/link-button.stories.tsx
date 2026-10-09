import { MemoryRouter } from 'react-router-dom'

import { LinkButton } from './link-button'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'shared/LinkButton',
  component: LinkButton,
  args: { to: '/sign-in', children: 'Sign in', size: 'l' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof LinkButton>

export default meta
type Story = StoryObj<typeof meta>
export const Navigation: Story = {}
