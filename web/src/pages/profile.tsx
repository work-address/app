import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { $authenticated } from '@/entities/profile'
import {
  $isAuthenticatedUserProfile,
  $profile,
  $profileFailure,
  buildProfileHead,
  ProfileGate,
  ProfileView,
  retryProfile,
} from '@/features/profile'
import { routes } from '@/routes'
import {
  Button,
  formatAddress,
  LoadFailure,
  PageHelmet,
  StateNotice,
  Wrapper,
} from '@/shared'

export default function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { id } = useParams<{ id: string }>()

  const { profile, isOwn, failure, retry, authenticated } = useUnit({
    profile: $profile,
    isOwn: $isAuthenticatedUserProfile,
    failure: $profileFailure,
    retry: retryProfile,
    authenticated: $authenticated,
  })

  if (!id) {
    return <Navigate to={routes.signIn.build()} />
  }

  const shortAddress = profile?.address ? formatAddress(profile.address) : ''
  const head = buildProfileHead(
    {
      name: profile?.name || profile?.title,
      address: shortAddress,
      isOwn,
      failure,
    },
    t,
  )

  return (
    <>
      <ProfileGate id={id} />
      <PageHelmet
        title={head.title}
        description={head.description}
        ogType="profile"
      />
      {failure === 'not-found' ? (
        <Wrapper width="document">
          <StateNotice
            size="page"
            title={t('profile.notFound.title')}
            description={t('profile.notFound.description')}
            actions={
              <Button
                size="l"
                onClick={() =>
                  navigate(
                    authenticated
                      ? routes.dashboard.build()
                      : routes.signIn.build(),
                  )
                }
              >
                {t(
                  authenticated
                    ? 'notFound.action.dashboard'
                    : 'profile.notFound.action',
                )}
              </Button>
            }
          />
        </Wrapper>
      ) : failure === 'failed' ? (
        <Wrapper width="document">
          <LoadFailure
            size="page"
            title={t('profile.loadFailure.title')}
            onRetry={retry}
          />
        </Wrapper>
      ) : (
        <ProfileView />
      )}
    </>
  )
}
