import { Cross1Icon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import type { TimeTrackerConnectPhase } from '@/features/time-tracker-connect'

import { $authenticated, $pending, $user } from '@/entities/profile'
import { AuthStyles as S, AuthProviders } from '@/features/auth'
import {
  initTimeTrackerConnect,
  buildTimeTrackerConnectView,
  resetTimeTrackerConnect,
  retryTimeTrackerConnect,
  $phase,
  $errorMessage,
  $errorName,
  getTimeTrackerNonceStorageKey,
} from '@/features/time-tracker-connect'
import { routes } from '@/routes'
import {
  Button,
  IconButton,
  Logo,
  LogoLabel,
  PageHelmet,
  Spinner,
  useBreakpoint,
} from '@/shared'

export default function ConnectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDesktop = useBreakpoint('isDesktop')
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')

  const {
    initConnect,
    resetConnect,
    retryConnect,
    phase,
    errorMessage,
    errorName,
    loading,
    authenticated,
    user,
  } = useUnit({
    initConnect: initTimeTrackerConnect,
    resetConnect: resetTimeTrackerConnect,
    retryConnect: retryTimeTrackerConnect,
    phase: $phase,
    errorMessage: $errorMessage,
    errorName: $errorName,
    loading: $pending,
    authenticated: $authenticated,
    user: $user,
  })

  useEffect(() => {
    if (!nonce) {
      resetConnect()
      return
    }

    initConnect(nonce)

    return () => {
      resetConnect()
    }
  }, [nonce, initConnect, resetConnect])

  const {
    showError,
    showConnected,
    showLoading,
    showWalletProviders,
    checkingLink,
    canRetry,
    showWayOn,
    headingKey,
    descriptionKey,
  } = buildTimeTrackerConnectView({
    nonce,
    phase,
    authenticated,
    authPending: loading,
    errorName,
  })
  const closeHref = authenticated
    ? routes.dashboard.build()
    : routes.signIn.build()

  return (
    <>
      <PageHelmet title={t('connect.title')} description={t('connect.meta')} />
      <IconButton asChild variant="ghost" radius="full" color="gray" size="4">
        <CloseLink to={closeHref} aria-label={t('connect.close')}>
          <Cross1Icon aria-hidden="true" />
        </CloseLink>
      </IconButton>
      <S.Logo src={isDesktop ? LogoLabel : Logo} alt={t('signIn.logoAlt')} />
      <S.SignInCard aria-busy={showLoading || undefined}>
        <S.Title>{t(headingKey)}</S.Title>
        <S.Desc role={showError ? 'alert' : showLoading ? 'status' : undefined}>
          {t(descriptionKey)}
        </S.Desc>
        {showLoading && (
          <Progress aria-hidden="true">
            {checkingLink ? (
              <>
                <Skeleton width="100%" height="52px" loading />
                <Skeleton width="100%" height="52px" loading />
              </>
            ) : (
              <Spinner size={40} />
            )}
          </Progress>
        )}
        {showWalletProviders && (
          <S.Actions>
            <AuthProviders />
          </S.Actions>
        )}
        {canRetry && (
          <Button variant="outline" onClick={retryConnect}>
            {t('common.loadFailure.retry')}
          </Button>
        )}
        {showConnected && (
          <Button onClick={() => navigate(routes.dashboard.build())}>
            {t('notFound.action.dashboard')}
          </Button>
        )}
        {/* A failure nothing here can retry, such as an incomplete link,
            still has a way on: the app, or signing in to it. */}
        {showWayOn && (
          <Button variant="outline" onClick={() => navigate(closeHref)}>
            {t(
              authenticated
                ? 'notFound.action.dashboard'
                : 'notFound.action.signIn',
            )}
          </Button>
        )}
      </S.SignInCard>
      {/* The pairing state stays on the page for support and for the
          tracker, but folded away: it is diagnostics, not content. */}
      <StatusDetails>
        <StatusSummary>{t('connect.status.summary')}</StatusSummary>
        <StatusNote>
          {t('connect.status.loginState')}: {getLoginStateLabel(phase, nonce)}
          <br />
          {t('connect.status.walletState')}:{' '}
          {authenticated
            ? t('connect.status.authenticated')
            : t('connect.status.unauthenticated')}
          <br />
          {t('connect.status.address')}: {user?.address ?? ''}
          <br />
          {t('connect.status.nonce')}: {nonce ?? ''}
          {errorMessage && (
            <>
              <br />
              {t('connect.status.error')}: {errorMessage}
            </>
          )}
        </StatusNote>
      </StatusDetails>
    </>
  )
}

const getLoginStateLabel = (
  phase: TimeTrackerConnectPhase,
  nonce: string | null,
): string => {
  if (
    !nonce ||
    phase === 'idle' ||
    phase === 'error' ||
    phase === 'awaiting_auth' ||
    phase === 'awaiting_pair'
  ) {
    if (
      nonce &&
      phase !== 'error' &&
      localStorage.getItem(getTimeTrackerNonceStorageKey(nonce))
    ) {
      return 'init'
    }

    return 'disconnected'
  }

  if (phase === 'connected') {
    return 'connected'
  }

  if (phase === 'loading' || phase === 'connecting') {
    return 'progress'
  }

  return 'disconnected'
}

const CloseLink = styled(Link)`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10;

  ${({ theme }) => theme.breakpoints.up('md')} {
    top: 24px;
    right: 24px;
  }
`

const Progress = styled.div`
  display: grid;
  place-items: center;
  gap: var(--ui-space-3);
  padding-bottom: var(--ui-space-4);
`

const StatusDetails = styled.details`
  margin-top: 20px;
  text-align: center;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-top: 24px;
  }
`

const StatusSummary = styled.summary`
  cursor: pointer;
  font-size: var(--ui-small-size);
  color: var(--ui-muted);

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
    border-radius: var(--ui-inline-radius);
  }
`

const StatusNote = styled.p`
  margin-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--ui-small-size);
  font-weight: 400;
  color: var(--ui-muted);
  letter-spacing: 0.2px;
  line-height: 1.5;
  text-align: center;
  /* A wallet address has no break opportunities; on a narrow phone it would
     otherwise run past the edge. */
  overflow-wrap: anywhere;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: var(--ui-small-size);
  }
`
