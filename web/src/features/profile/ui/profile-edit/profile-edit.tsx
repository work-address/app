import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import styled from 'styled-components'

import { $profile, $profileLoading } from '../../model'

import { ProfileEditDetails } from './profile-edit-details'
import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditLinks } from './profile-edit-links'

import { saveProfileMutation } from '@/entities/profile'
import { useLeaveConfirm, useConfirm, useBreakpoint } from '@/shared'

const EMPTY_FORM_VALUES: ProfileEditFormState = {
  name: '',
  email: '',
  title: '',
  company: '',
  skills: [],
  rate: '',
  bio: '',
  facebook: '',
  linkedIn: '',
  telegram: '',
  twitter: '',
  instagram: '',
  youtube: '',
  city: '',
  country: '',
}

export const ProfileEdit = () => {
  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()

  const user = useUnit($profile)

  const { profileSaving, profileLoading, saveProfile } = useUnit({
    profileSaving: saveProfileMutation.$pending,
    profileLoading: $profileLoading,
    saveProfile: saveProfileMutation.start,
  })

  const {
    register,
    control,
    formState: { isDirty, errors },
    handleSubmit,
    reset: resetForm,
    setValue,
  } = useForm<ProfileEditFormState>({
    values: EMPTY_FORM_VALUES,
  })

  const onSubmit: SubmitHandler<ProfileEditFormState> = async (values) => {
    const { email, ...rest } = values
    const trimmedEmail = email?.trim()

    saveProfile({
      ...rest,
      skills: values.skills.join(',') || '',
      // An empty email is dropped rather than sent as '': the column carries a
      // unique index, and the backend rejects a blank email for an account
      // that has no phone. Omitting the key leaves the stored value untouched.
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
    })
  }

  const onReset = () => {
    confirm().then(() => resetForm())
  }

  useLeaveConfirm({ when: isDirty })

  // react-hook-form owns the draft, so seeding it from the loaded profile
  // stays a React concern.
  useEffect(() => {
    if (user) {
      resetForm({
        name: user.name ?? user.title ?? '',
        email: user.email || '',
        title: user.name ? (user.title ?? '') : '',
        company: user.company || '',
        skills: user.skills ? user.skills?.split(',') : [],
        rate: user.rate || '',
        bio: user.bio || '',
        facebook: user.facebook || '',
        linkedIn: user.linkedIn || '',
        telegram: user.telegram || '',
        twitter: user.twitter || '',
        instagram: user.instagram || '',
        youtube: user.youtube || '',
        city: user.city || '',
        country: user.country || '',
      })
    }
  }, [user, resetForm])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Root>
        <Grid rows={{ initial: 'auto auto' }} gap={'20px'}>
          <ProfileEditDetails
            user={user}
            isDesktop={isDesktop}
            profileLoading={profileLoading}
            isDirty={isDirty}
            profileSaving={profileSaving}
            onReset={onReset}
            register={register}
            control={control}
            errors={errors}
          />
          <ProfileEditLinks
            isDesktop={isDesktop}
            profileLoading={profileLoading}
            isDirty={isDirty}
            profileSaving={profileSaving}
            onReset={onReset}
            register={register}
            errors={errors}
            setValue={setValue}
          />
        </Grid>
      </Root>
    </form>
  )
}

const Root = styled.div`
  padding-bottom: 50px;

  ${(p) => p.theme.breakpoints.up('md')} {
    max-width: 710px;
    margin: 0 auto;
    padding: 26px 28px 40px;
  }
`
