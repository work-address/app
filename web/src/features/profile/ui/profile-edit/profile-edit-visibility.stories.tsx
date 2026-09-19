import { useForm } from 'react-hook-form'
import styled from 'styled-components'

import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditVisibility } from './profile-edit-visibility'

import type { Meta, StoryObj } from '@storybook/react-vite'

type HarnessProps = {
  visible: boolean
  isDesktop: boolean
  profileSaving: boolean
}

/** The control owns no state: it edits the profile form's `visible` field. */
const Harness = ({ visible, isDesktop, profileSaving }: HarnessProps) => {
  const { control } = useForm<ProfileEditFormState>({
    defaultValues: { visible },
  })

  return (
    <ProfileEditVisibility
      isDesktop={isDesktop}
      profileLoading={false}
      profileSaving={profileSaving}
      control={control}
    />
  )
}

const meta = {
  title: 'features/profile/ProfileEditVisibility',
  component: Harness,
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  args: { visible: true, isDesktop: true, profileSaving: false },
} satisfies Meta<typeof Harness>

export default meta

type Story = StoryObj<typeof meta>

/** data-state="public": anyone with the link opens the page. */
export const Public: Story = {}

/** data-state="hidden": only the holder opens it; the chain note stays. */
export const Hidden: Story = {
  args: { visible: false },
}

/** While the profile saves, the choice cannot change under it. */
export const Saving: Story = {
  args: { profileSaving: true },
}

const Frame = styled.div`
  display: grid;
  max-width: 710px;
`
