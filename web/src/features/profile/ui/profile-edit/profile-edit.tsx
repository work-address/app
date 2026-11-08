import {
  ArrowLeftIcon,
  Link2Icon,
  LockClosedIcon,
  PersonIcon,
} from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { type FieldErrors, type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $profile,
  $profileLoading,
  $profileFailure,
  retryProfile,
  SOCIAL_LINKS,
} from '../../model'

import { ProfileEditAccount } from './profile-edit-account'
import { ProfileEditActions } from './profile-edit-actions'
import { ProfileEditDetails } from './profile-edit-details'
import { type ProfileEditFormState } from './profile-edit-field'
import { ProfileEditLinks } from './profile-edit-links'
import { ProfileEditPreview } from './profile-edit-preview'

import { saveProfileMutation } from '@/entities/profile'
import { ConnectedWalletCard } from '@/features/connected-wallet'
import { LocalWalletCard } from '@/features/local-wallet'
import { routes } from '@/routes'
import {
  IconButton,
  LoadFailure,
  PageHeader,
  ToolbarSegment,
  ToolbarShell,
  Tooltip,
  useLeaveConfirm,
  useConfirm,
  useBreakpoint,
  Wrapper,
} from '@/shared'

const FORM_ID = 'profile-edit-form'

type ProfileEditTab = 'details' | 'links' | 'account'

const TABS: {
  id: ProfileEditTab
  labelKey: string
  icon: typeof PersonIcon
}[] = [
  { id: 'details', labelKey: 'settings.tabs.profile', icon: PersonIcon },
  { id: 'links', labelKey: 'settings.tabs.links', icon: Link2Icon },
  { id: 'account', labelKey: 'settings.tabs.account', icon: LockClosedIcon },
]

const LINK_FIELDS = new Set<string>(SOCIAL_LINKS.map(({ name }) => name))

type Props = {
  /** Reached as Settings from the navigation, or to edit from the profile. */
  variant?: 'edit' | 'settings'
}

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

export const ProfileEdit = ({ variant = 'edit' }: Props) => {
  const { t } = useTranslation()
  // Every section stays mounted and only hides, so switching keeps the draft.
  const [tab, setTab] = useState<ProfileEditTab>('details')
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

  // A field that fails validation in a hidden section brings it forward.
  const onInvalid = (invalid: FieldErrors<ProfileEditFormState>) => {
    const fields = Object.keys(invalid)

    if (fields.length > 0) {
      setTab(
        fields.every((field) => LINK_FIELDS.has(field)) ? 'links' : 'details',
      )
    }
  }

  // Arrow keys move along the tabs, as a tab list's do.
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0

    if (step === 0) {
      return
    }

    event.preventDefault()
    const index = TABS.findIndex(({ id }) => id === tab)
    const next = TABS[(index + step + TABS.length) % TABS.length]

    setTab(next.id)
    document.getElementById(`profile-edit-tab-${next.id}`)?.focus()
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
        eyebrow={t('settings.page.eyebrow')}
        title={
          variant === 'settings'
            ? t('settings.page.title')
            : t('app.documentTitle.profileEdit')
        }
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
        <LoadFailure
          size="panel"
          title={t('profile.loadFailure.title')}
          onRetry={retry}
        />
      ) : (
        <>
          <Tabs
            role="tablist"
            aria-label={t('settings.tabs.label')}
            onKeyDown={onTabKeyDown}
          >
            {TABS.map(({ id, labelKey, icon: Icon }) => (
              <Tab
                key={id}
                id={`profile-edit-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`profile-edit-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
              >
                <Icon aria-hidden />
                {t(labelKey)}
              </Tab>
            ))}
          </Tabs>
          <Layout>
            <Main>
              {/* The wallet cards sit outside the form: their own dialogs
                  submit, and a submit inside a form would save the profile
                  instead. */}
              <form
                id={FORM_ID}
                onSubmit={handleSubmit(onSubmit, onInvalid)}
                aria-busy={profileLoading || profileSaving || undefined}
              >
                <Sections
                  initial="hidden"
                  animate="shown"
                  variants={reveal.list}
                >
                  <Panel
                    variants={reveal.item}
                    id="profile-edit-panel-details"
                    role="tabpanel"
                    aria-labelledby="profile-edit-tab-details"
                    hidden={tab !== 'details'}
                  >
                    <ProfileEditDetails
                      user={user}
                      isDesktop={isDesktop}
                      profileLoading={profileLoading}
                      profileSaving={profileSaving || profileLoading}
                      register={register}
                      control={control}
                      errors={errors}
                    />
                  </Panel>
                  <Panel
                    variants={reveal.item}
                    id="profile-edit-panel-links"
                    role="tabpanel"
                    aria-labelledby="profile-edit-tab-links"
                    hidden={tab !== 'links'}
                  >
                    <ProfileEditLinks
                      isDesktop={isDesktop}
                      profileLoading={profileLoading}
                      profileSaving={profileSaving || profileLoading}
                      register={register}
                      errors={errors}
                      setValue={setValue}
                    />
                  </Panel>
                </Sections>
              </form>
              <Panel
                id="profile-edit-panel-account"
                role="tabpanel"
                aria-labelledby="profile-edit-tab-account"
                hidden={tab !== 'account'}
              >
                <ProfileEditAccount
                  user={user}
                  profileLoading={profileLoading}
                />
                <ConnectedWalletCard />
                <LocalWalletCard />
              </Panel>
            </Main>
            {/* Beside the form where there is room for both, under it
                elsewhere. */}
            <ProfileEditPreview
              control={control}
              profileId={user?.id}
              loading={profileLoading}
            />
          </Layout>
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
  display: grid;
  align-content: start;
  gap: var(--ui-section-gap);

  /* Clears the fixed Cancel/Save sheet on phones, so the last field can
     scroll out from under it. */
  ${(p) => p.theme.breakpoints.down('md')} {
    padding-bottom: 96px;
  }
`

const Sections = styled(motion.div)`
  display: grid;
  gap: var(--ui-section-gap);
`

/* The sections as tabs on one segmented control. */
const Tabs = styled(ToolbarShell)`
  justify-self: start;
  max-width: 100%;

  /* A phone gives each tab a third of the width; labels wrap to fit. */
  ${(p) => p.theme.breakpoints.down('md')} {
    justify-self: stretch;
    grid-auto-columns: minmax(0, 1fr);
  }
`

const Tab = styled(ToolbarSegment)`
  & svg {
    flex-shrink: 0;
    width: var(--ui-space-4);
    height: var(--ui-space-4);
  }

  /* A phone's tabs are their words alone, as many lines as they need. */
  ${(p) => p.theme.breakpoints.down('md')} {
    padding-block: var(--ui-space-2);
    line-height: var(--ui-meta-line-height);
    text-align: center;
    white-space: normal;

    & svg {
      display: none;
    }
  }
`

/* The form beside how the profile will read; the preview needs a wide page. */
const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-section-gap);

  ${(p) => p.theme.breakpoints.up('xl')} {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
`

/* One section shows at a time, so the column needs no gap of its own: a
   hidden form would otherwise still push the account panel down. */
const Main = styled.div`
  display: grid;
  min-width: 0;
`

/* Hidden, not unmounted: a section's fields keep their draft. */
const Panel = styled(motion.div)`
  display: grid;
  gap: var(--ui-section-gap);
  min-width: 0;

  &[hidden] {
    display: none;
  }
`

const BottomSheet = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-2);
  /* Clears the home indicator on phones without a hardware button. */
  padding: var(--ui-space-3) var(--ui-space-4)
    calc(var(--ui-space-3) + env(safe-area-inset-bottom, 0px));
  background: var(--ui-surface);
  border-top: var(--ui-border-width) solid var(--ui-line);
  box-shadow: var(--ui-shadow);
`
