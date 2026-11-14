import { Cross1Icon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import styled, { css } from 'styled-components'

import type { TimeTrackerConnectPhase } from '@/features/time-tracker-connect'

import { $authenticated, $pending, $user } from '@/entities/profile'
import { AuthStyles as S, AuthProviders } from '@/features/auth'
import {
  initTimeTrackerConnect,
  buildTimeTrackerConnectView,
  confirmTimeTrackerConnect,
  finishWebsiteSignIn,
  isPhoneClient,
  leaveForWebsite,
  parseWebsiteReturn,
  PHONE_APP_RETURN_URL,
  returnToPhoneApp,
  resetTimeTrackerConnect,
  retryTimeTrackerConnect,
  timeTrackerConnectOpenedBy,
  $phase,
  $errorMessage,
  $errorName,
  getTimeTrackerNonceStorageKey,
} from '@/features/time-tracker-connect'
import { routes } from '@/routes'
import {
  Button,
  IconButton,
  LinkButton,
  Logo,
  LogoLabel,
  PageHelmet,
  Spinner,
  useBreakpoint,
  WEBSITE_ORIGINS,
} from '@/shared'

export default function ConnectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDesktop = useBreakpoint('isDesktop')
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')
  const websiteReturn = parseWebsiteReturn(
    searchParams.get('return_to'),
    WEBSITE_ORIGINS,
  )
  const fromWebsite = websiteReturn !== null
  // `client=phone` from the phone app. The website's return address wins, so
  // a link cannot be both.
  const fromPhone = !fromWebsite && isPhoneClient(searchParams.get('client'))

  const {
    confirmConnect,
    initConnect,
    resetConnect,
    retryConnect,
    setOpenedBy,
    phase,
    errorMessage,
    errorName,
    loading,
    authenticated,
    user,
  } = useUnit({
    confirmConnect: confirmTimeTrackerConnect,
    initConnect: initTimeTrackerConnect,
    resetConnect: resetTimeTrackerConnect,
    retryConnect: retryTimeTrackerConnect,
    setOpenedBy: timeTrackerConnectOpenedBy,
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

    setOpenedBy(fromWebsite ? 'website' : fromPhone ? 'phone' : 'tracker')
    initConnect(nonce)

    return () => {
      resetConnect()
    }
  }, [nonce, fromWebsite, fromPhone, initConnect, resetConnect, setOpenedBy])

  const {
    showError,
    showConnected,
    showLoading,
    showWalletProviders,
    showConfirm,
    confirmKey,
    checkingLink,
    canRetry,
    showWayOn,
    showReturnToApp,
    headingKey,
    descriptionKey,
  } = buildTimeTrackerConnectView({
    nonce,
    phase,
    authenticated,
    authPending: loading,
    errorName,
    fromWebsite,
    fromPhone,
  })
  const closeHref = authenticated
    ? routes.dashboard.build()
    : routes.signIn.build()

  // A website sign-in ends back on the website, not here.
  useEffect(() => {
    if (websiteReturn && showConnected) {
      finishWebsiteSignIn(window, websiteReturn)
    }
  }, [websiteReturn, showConnected])

  // One automatic attempt to go back to the phone app. The button below is
  // the way back when the browser waits for a tap.
  const triedReturn = useRef(false)

  useEffect(() => {
    if (showReturnToApp && !triedReturn.current) {
      triedReturn.current = true
      returnToPhoneApp(window)
    }
  }, [showReturnToApp])

  const backToWebsite = () => {
    if (websiteReturn) {
      leaveForWebsite(window, websiteReturn)
    }
  }

  return (
    <>
      <PageHelmet
        title={t(fromWebsite ? 'connect.website.title' : 'connect.title')}
        description={t(fromWebsite ? 'connect.website.meta' : 'connect.meta')}
      />
      <IconButton asChild variant="ghost" radius="full" color="gray" size="4">
        {fromWebsite ? (
          <CloseButton
            type="button"
            aria-label={t('connect.website.close')}
            onClick={backToWebsite}
          >
            <Cross1Icon aria-hidden="true" />
          </CloseButton>
        ) : (
          <CloseLink to={closeHref} aria-label={t('connect.close')}>
            <Cross1Icon aria-hidden="true" />
          </CloseLink>
        )}
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
        {/* Nothing pairs by itself: the reader says so, knowing which
            account the link would sign in as. */}
        {showConfirm && (
          <S.Actions>
            <ConfirmAccount>
              {t('connect.confirmAccount', {
                account: user?.name || user?.email || user?.address || '',
              })}
            </ConfirmAccount>
            <Button onClick={confirmConnect}>{t(confirmKey)}</Button>
          </S.Actions>
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
        {fromWebsite ? (
          (showConnected || showWayOn) && (
            <Button
              variant={showConnected ? undefined : 'outline'}
              onClick={backToWebsite}
            >
              {t('connect.website.back')}
            </Button>
          )
        ) : (
          <>
            {showReturnToApp ? (
              // A plain link, so a tap leaves for the app as any link would.
              <LinkButton to={PHONE_APP_RETURN_URL} reloadDocument>
                {t('connect.phone.return')}
              </LinkButton>
            ) : (
              showConnected && (
                <Button onClick={() => navigate(routes.dashboard.build())}>
                  {t('notFound.action.dashboard')}
                </Button>
              )
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
          </>
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

const closePosition = css`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10;

  ${({ theme }) => theme.breakpoints.up('md')} {
    top: 24px;
    right: 24px;
  }
`

const CloseLink = styled(Link)`
  ${closePosition}
`

const CloseButton = styled.button`
  ${closePosition}
`

const ConfirmAccount = styled.p`
  font-size: var(--ui-small-size);
  color: var(--ui-muted);
  text-align: center;
  overflow-wrap: anywhere;
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
