import { fn } from 'storybook/test'

import { Button } from '../button'

import { LoadFailure, StateNotice } from './state-notice'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'shared/StateNotice',
  component: StateNotice,
  parameters: { layout: 'padded' },
  args: {
    title: 'No invoices yet',
    description:
      'Create one from a project to bill for the time you have tracked.',
  },
} satisfies Meta<typeof StateNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {
  args: {
    actions: (
      <Button size="l" variant="outline">
        Go to your projects
      </Button>
    ),
  },
}

export const Error: Story = {
  args: {
    tone: 'error',
    title: 'Could not load invoices',
    description:
      'The request did not reach the server. Check your connection and try again.',
  },
}

export const Page: Story = {
  args: {
    size: 'page',
    title: 'This invoice does not exist',
    description:
      'It may have been removed, or the link is incomplete. Every invoice you can see is on the Invoices page.',
    actions: <Button size="l">Open your invoices</Button>,
  },
}

export const Failure: StoryObj<typeof LoadFailure> = {
  render: (args) => <LoadFailure {...args} />,
  args: { onRetry: fn() },
}
