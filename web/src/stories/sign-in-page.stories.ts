import { SignInPage } from './sign-in-page'

import type { Meta, StoryObj } from '@storybook/react-vite'

import { fetchAuthMethodsFx } from '@/entities/profile'

const meta = {
  title: 'Pages/SignIn',
  component: SignInPage,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SignInPage>

export default meta
type Story = StoryObj<typeof meta>

/** Storybook has no API, so each story answers what the deployment offers. */
const methods = (answer: () => Promise<{ googleClientId?: string }>) => () => {
  fetchAuthMethodsFx.use(answer as never)
}

export const GoogleAndWallet: Story = {
  beforeEach: methods(async () => ({ googleClientId: 'storybook-client-id' })),
}

export const WaitingForTheDeployment: Story = {
  beforeEach: methods(() => new Promise(() => {})),
}

export const WalletOnly: Story = {
  beforeEach: methods(async () => ({})),
}

export const MethodsFailed: Story = {
  beforeEach: methods(async () => {
    throw new Error('The API did not answer')
  }),
}
