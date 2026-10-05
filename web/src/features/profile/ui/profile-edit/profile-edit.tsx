import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { $profile, $profileLoading } from '../../model'

import { ProfileEditActions } from './profile-edit-actions'
import { ProfileEditDetails } from './profile-edit-details'
import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditLinks } from './profile-edit-links'

import { saveProfileMutation } from '@/entities/profile'
import { LocalWalletCard } from '@/features/local-wallet'
import { routes } from '@/routes'
import {
  IconButton,
  PageHeader,
  Tooltip,
  useLeaveConfirm,
  useConfirm,
  useBreakpoint,
  Wrapper,
} from '@/shared'

const FORM_ID = 'profile-edit-form'

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
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()

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

  // react-hook-form owns the draft, so seeding it from the loaded profile
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
      })
    }
  }, [user, resetForm])

  // Back returns to where the visitor came from, normally the profile, and
  // only falls back to it on a fresh tab. The leave guard still asks first.
  const goBack = () => {
    if (location.key === 'default') {
      navigate(
        routes.profile.build({
          walletAddress: user?.friendlyWalletAddress ?? '',
        }),
      )
    } else {
      navigate(-1)
    }
  }

  return (
    <Root width="document">
      <PageHeader
        leading={
          <Tooltip content={t('profile.aria.back')}>
            <IconButton
              radius={'full'}
              variant={'ghost'}
              color={'gray'}
              type={'button'}
              aria-label={t('profile.aria.back')}
              onClick={goBack}
            >
              <ArrowLeftIcon width={20} height={20} />
            </IconButton>
          </Tooltip>
        }
        title={t('app.documentTitle.profileEdit')}
        description={t('profile.form.edit.description')}
        actions={
          isDesktop ? (
            <ProfileEditActions
              isDirty={isDirty}
              profileSaving={profileSaving}
              onReset={onReset}
              formId={FORM_ID}
            />
          ) : null
        }
      />
      {/* The wallet card sits outside the form: its own dialogs submit, and
          a submit inside a form would save the profile instead. */}
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)}>
        <Sections>
          <ProfileEditDetails
            user={user}
            isDesktop={isDesktop}
            profileLoading={profileLoading}
            profileSaving={profileSaving}
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
        </Sections>
      </form>
      <LocalWalletCard />
    </Root>
  )
}

const Root = styled(Wrapper)`
  display: grid;
  gap: 20px;

  /* Clears the fixed Cancel/Save sheet on phones, so the last field can
     scroll out from under it. */
  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--space-4);
    padding-bottom: 96px;
  }
`

const Sections = styled.div`
  display: grid;
  gap: 20px;

  /* No gap on a phone. The sections carry neither border nor shadow there,
     so a blank band between two white blocks read as one form with a hole
     in it. Each section rules its own top edge instead. */
  ${(p) => p.theme.breakpoints.down('md')} {
    gap: 0;
  }
`
