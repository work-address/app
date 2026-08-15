import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { $profile, $profileLoading } from '../../model'

import { ProfileEditDetails } from './profile-edit-details'
import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditLinks } from './profile-edit-links'

import { saveProfileMutation } from '@/entities/profile'
import { routes } from '@/routes'
import { useLeaveConfirm, useConfirm, showToast, useBreakpoint } from '@/shared'

const EMPTY_FORM_VALUES: ProfileEditFormState = {
  name: '',
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
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()

  const [isFormSubmittedSuccessfully, setIsFormSubmittedSuccessfully] =
    useState(false)

  const user = useUnit($profile)

  const { profileSaving, profileLoading, saveProfile, status, resetMutation } =
    useUnit({
      profileSaving: saveProfileMutation.$pending,
      profileLoading: $profileLoading,
      saveProfile: saveProfileMutation.start,
      status: saveProfileMutation.$status,
      resetMutation: saveProfileMutation.reset,
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
    saveProfile({
      ...values,
      skills: values.skills.join(',') || '',
      // TODO: remove this when backend will be ready
      emailOrPhone: user?.emailOrPhone || '',
    })
  }

  const onReset = () => {
    confirm().then(() => resetForm())
  }

  useLeaveConfirm({ when: isDirty })

  useEffect(() => {
    if (isFormSubmittedSuccessfully) {
      setIsFormSubmittedSuccessfully(false)

      navigate(
        routes.profile.build({
          walletAddress: user?.friendlyWalletAddress || '',
        }),
        { viewTransition: true },
      )
    }
  }, [isFormSubmittedSuccessfully, navigate, user?.friendlyWalletAddress])

  useEffect(() => {
    if (status === 'done') {
      showToast('info', {
        message: t('profile.form.edit.success'),
        position: 'top-center',
        closeButton: true,
      })

      setIsFormSubmittedSuccessfully(true)
      resetForm()
      resetMutation()
    } else if (status === 'fail') {
      showToast('error', {
        message: t('profile.form.edit.error'),
        position: 'top-center',
        closeButton: true,
      })

      resetMutation()
    }
  }, [status, resetMutation, navigate, resetForm, t])

  useEffect(() => {
    if (user) {
      resetForm({
        name: user.name ?? user.title ?? '',
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
        <Grid rows={{ initial: 'auto auto' }}>
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
