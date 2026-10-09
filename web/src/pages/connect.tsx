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
      <PageHelmet
        title={t('connect.title')}
        description={t('connect.meta')}
        noindex
      />
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
          {t('connect.status.address')}: {user?.friendlyWalletAddress ?? ''}
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
  gap: var(--space-3);
  padding-bottom: var(--space-4);
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
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
    border-radius: var(--radius-1);
  }
`

const StatusNote = styled.p`
  margin-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-0);
  font-weight: 400;
  color: var(--c-rgba-0-7-20-0_52);
  letter-spacing: 0.2px;
  line-height: 1.5;
  text-align: center;
  /* A wallet address has no break opportunities; on a narrow phone it would
     otherwise run past the edge. */
  overflow-wrap: anywhere;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: var(--font-size-1);
  }
`
