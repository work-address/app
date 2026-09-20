import { Grid } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profileLoading } from '../../model'

import { ProfileEditDetails } from './profile-edit-details'
import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditLinks } from './profile-edit-links'
import { ProfileEditVisibility } from './profile-edit-visibility'

import { $user, saveProfileMutation } from '@/entities/profile'
import { IdentityCard } from '@/features/identity'
import { LocalWalletCard } from '@/features/local-wallet'
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
  visible: true,
}

export const ProfileEdit = () => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()

  // The holder's own record, not the public profile the page shows: only the
  // holder reaches this form, and only their own record carries the email.
  const user = useUnit($user)

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
    const { email, rate, ...rest } = values
    const trimmedEmail = email?.trim()
    const trimmedRate = rate?.trim()

    saveProfile({
      ...rest,
      skills: values.skills.join(',') || '',
      // A cleared rate goes as null, not '': the column is numeric, and
      // Postgres rejects an empty string for it. Null is what "no rate" means
      // on a nullable column, and it reads back as 0.00 like an unset profile.
      rate: trimmedRate || null,
      // An empty email is dropped rather than sent as '': the column carries a
      // unique index, and the backend rejects a blank email for an account
      // that has no phone. Omitting the key leaves the stored value untouched.
      // An unchanged one is dropped too - the uniqueness check would otherwise
      // find the account's own row and refuse the save.
      ...(trimmedEmail && trimmedEmail !== user?.email
        ? { email: trimmedEmail }
        : {}),
    })
  }

  const onReset = () => {
    confirm({
      title: t('profile.form.discard.title'),
      description: t('profile.form.discard.description'),
      confirmLabel: t('profile.form.discard.confirm'),
      cancelLabel: t('profile.form.discard.cancel'),
    })
      .then(() => resetForm())
      .catch(() => {})
  }

  // Not while a save is in flight: the model routes back to the profile the
  // moment the save lands, before React has had a chance to re-seed the form
  // from the stored user - so the draft still counts as dirty at that instant
  // and the guard would ask "leave this page?" about changes just saved.
  useLeaveConfirm({
    when: isDirty && !profileSaving,
    title: t('profile.form.leave.title'),
    description: t('profile.form.leave.description'),
    confirmLabel: t('profile.form.leave.confirm'),
    cancelLabel: t('profile.form.leave.cancel'),
  })

  // react-hook-form owns the draft, so seeding it from the holder's record
  // stays a React concern.
  useEffect(() => {
    if (user) {
      // A profile that never had a name shows its title in the name field, and
      // the title field is blanked so the same string is not offered twice.
      // That promotion keys off an unset name, not an empty one - a name the
      // user cleared on purpose must leave the stored title visible, or the
      // next save would silently blank it too.
      const nameUnset = user.name === null || user.name === undefined

      resetForm({
        name: user.name ?? user.title ?? '',
        email: user.email || '',
        title: nameUnset ? '' : (user.title ?? ''),
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
        // A record from before the flag reads as what it was: public.
        visible: user.visible !== false,
      })
    }
  }, [user, resetForm])

  return (
    <Root>
      {/* The wallet card sits outside the form: its own dialogs submit, and
          a submit inside a form would save the profile instead. */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid
          rows={{ initial: 'auto auto auto' }}
          gap={{ initial: '0', md: '20px' }}
        >
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
          <ProfileEditVisibility
            isDesktop={isDesktop}
            profileLoading={profileLoading}
            profileSaving={profileSaving}
            control={control}
          />
        </Grid>
      </form>
      {/* Outside the form for the same reason the wallet card is: both open
          dialogs whose submit would otherwise save the profile. */}
      <IdentityCard />
      <LocalWalletCard />
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  flex-direction: column;
  /* No gap on a phone. The sections are full-bleed and carry neither border
     nor shadow there, so a blank 20px between two white blocks read as one
     form with a hole in it. Each section rules its own top edge instead. */
  gap: 0;
  /* Clears the fixed Cancel/Save sheet on phones, so the last field can
     scroll out from under it. */
  padding-bottom: 96px;

  ${(p) => p.theme.breakpoints.up('md')} {
    gap: 20px;
    max-width: 710px;
    margin: 0 auto;
    padding: 26px 28px 40px;
  }
`
