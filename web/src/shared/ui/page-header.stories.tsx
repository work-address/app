import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Badge } from '@radix-ui/themes'

import { Button, IconButton } from './button'
import { PageHeader } from './page-header'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'shared/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  args: { title: 'Invoices' },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const TitleOnly: Story = {}

export const WithDescriptionAndActions: Story = {
  args: {
    description:
      'Every invoice you have issued, plus those on projects you own or view.',
    actions: <Button variant="outline">All projects</Button>,
  },
}

export const WithBadgeAndBack: Story = {
  args: {
    title: 'Edit profile',
    badge: <Badge color="gray">Draft</Badge>,
    leading: (
      <IconButton variant="ghost" radius="full" color="gray" aria-label="Back">
        <ArrowLeftIcon />
      </IconButton>
    ),
    description:
      'What you save here is what visitors see on your public profile.',
    actions: (
      <>
        <Button color="neutral" variant="soft">
          Cancel
        </Button>
        <Button>Save changes</Button>
      </>
    ),
  },
}
