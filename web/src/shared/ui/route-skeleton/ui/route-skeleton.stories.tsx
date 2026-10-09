import { RouteSkeleton } from './route-skeleton'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'shared/RouteSkeleton',
  component: RouteSkeleton,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RouteSkeleton>

export default meta
type Story = StoryObj<typeof meta>
export const List: Story = { args: { variant: 'list' } }
export const Document: Story = { args: { variant: 'document' } }
export const Auth: Story = { args: { variant: 'auth' } }
