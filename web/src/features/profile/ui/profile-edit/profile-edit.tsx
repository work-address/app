import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $profile,
  $profileLoading,
  $profileFailure,
  retryProfile,
} from '../../model'

import { ProfileEditActions } from './profile-edit-actions'
import { ProfileEditDetails } from './profile-edit-details'
import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditLinks } from './profile-edit-links'

import { saveProfileMutation } from '@/entities/profile'
import { ConnectedWalletCard } from '@/features/connected-wallet'
import { LocalWalletCard } from '@/features/local-wallet'
import { routes } from '@/routes'
import {
  IconButton,
  LoadFailure,
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

  const reducedMotion = useReducedMotion()
  const reveal = reducedMotion ? REVEAL_STILL : REVEAL

  const user = useUnit($profile)

  const { profileSaving, profileLoading, profileFailure, retry, saveProfile } =
    useUnit({
      profileSaving: saveProfileMutation.$pending,
      profileLoading: $profileLoading,
      profileFailure: $profileFailure,
      retry: retryProfile,
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
    if (profileLoading || profileFailure) {
      return
    }

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
      // Nullable email uses the same clear contract as rate. Undefined means
      // unchanged; null deliberately removes an existing email.
      ...((trimmedEmail || null) === (user?.email || null)
        ? {}
        : { email: trimmedEmail || null }),
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
          id: user?.id ?? '',
        }),
      )
    } else {
      navigate(-1)
    }
  }

  const sheetHost = document.querySelector('main')

  return (
    <Root>
      <Header
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
          isDesktop && !profileFailure ? (
            <ProfileEditActions
              isDirty={isDirty && !profileLoading}
              profileSaving={profileSaving}
              onReset={onReset}
              formId={FORM_ID}
            />
          ) : null
        }
      />
      {profileFailure ? (
        <LoadFailure title={t('profile.loadFailure.title')} onRetry={retry} />
      ) : (
        <>
          {/* The wallet card sits outside the form: its own dialogs submit, and
              a submit inside a form would save the profile instead. */}
          <form
            id={FORM_ID}
            onSubmit={handleSubmit(onSubmit)}
            aria-busy={profileLoading || profileSaving || undefined}
          >
            <motion.div initial="hidden" animate="shown" variants={reveal.list}>
              <motion.div variants={reveal.item}>
                <ProfileEditDetails
                  user={user}
                  isDesktop={isDesktop}
                  profileLoading={profileLoading}
                  profileSaving={profileSaving || profileLoading}
                  register={register}
                  control={control}
                  errors={errors}
                />
              </motion.div>
              <motion.div variants={reveal.item}>
                <ProfileEditLinks
                  isDesktop={isDesktop}
                  profileLoading={profileLoading}
                  profileSaving={profileSaving || profileLoading}
                  register={register}
                  errors={errors}
                  setValue={setValue}
                />
              </motion.div>
            </motion.div>
          </form>
          <ConnectedWalletCard />
          <LocalWalletCard />
          {/* The page scrolls under a mask that dissolves its last 40px, and
              the mask takes anything inside the scroller with it, fixed or
              not. So the bar goes on the sheet itself, as the page indicator
              does, which also keeps it clear of the phone's sidebar rail. */}
          {!isDesktop &&
            sheetHost &&
            createPortal(
              <BottomSheet data-bottom-sheet>
                <ProfileEditActions
                  isDirty={isDirty && !profileLoading}
                  profileSaving={profileSaving || profileLoading}
                  onReset={onReset}
                  formId={FORM_ID}
                  stretch
                />
              </BottomSheet>,
              sheetHost,
            )}
        </>
      )}
    </Root>
  )
}

const REVEAL = {
  list: { shown: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: 0.24 } },
  },
}

const REVEAL_STILL = {
  list: {},
  item: { hidden: { opacity: 1 }, shown: { opacity: 1 } },
}

const Root = styled(Wrapper)`
  /* Clears the fixed Cancel/Save sheet on phones, so the last field can
     scroll out from under it. */
  ${(p) => p.theme.breakpoints.down('md')} {
    padding-bottom: 96px;
  }
`

const Header = styled(PageHeader)`
  padding-bottom: var(--space-5);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding-bottom: var(--space-4);
  }
`

const BottomSheet = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  /* Clears the home indicator on phones without a hardware button. */
  padding: var(--space-2) var(--space-4)
    calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  background: var(--white);
  border-top: 1px solid var(--ds-neutral-alpha-6);
`
