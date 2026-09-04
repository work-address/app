import { Cross1Icon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import type { TimeTrackerConnectPhase } from '@/features/time-tracker-connect'

import {
  $authenticated,
  $pending,
  $user,
  login,
  type LoginMode,
} from '@/entities/profile'
import { AuthStyles as S, AuthProviderButton } from '@/features/auth'
import {
  initTimeTrackerConnect,
  resetTimeTrackerConnect,
  $phase,
  $errorMessage,
  $errorName,
  getTimeTrackerNonceStorageKey,
} from '@/features/time-tracker-connect'
import { routes } from '@/routes'
import {
  Button,
  EthereumLogo,
  IconButton,
  Logo,
  LogoLabel,
  PageHelmet,
  SolanaLogo,
  Spinner,
  Text,
  TonLogo,
  useBreakpoint,
} from '@/shared'

export default function ConnectPage() {
  const { t, i18n } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')

  const {
    initConnect,
    resetConnect,
    phase,
    errorMessage,
    errorName,
    loading,
    authenticated,
    user,
  } = useUnit({
    initConnect: initTimeTrackerConnect,
    resetConnect: resetTimeTrackerConnect,
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

  const onSignIn = (mode: LoginMode) => {
    login(mode)
  }

  const isAuthError = errorName === 'AuthenticationException'
  const isTimeTrackerError = errorName === 'TimeTrackerException'
  const showError = phase === 'error' && Boolean(errorMessage)
  const showConnected = phase === 'connected'
  const showWalletProviders =
    Boolean(nonce) &&
    !authenticated &&
    !showConnected &&
    !isAuthError &&
    phase !== 'connecting'
  const showPairingMessage =
    Boolean(nonce) &&
    !showConnected &&
    (showWalletProviders ||
      showError ||
      phase === 'awaiting_pair' ||
      phase === 'connecting')
  const showLoading =
    Boolean(nonce) &&
    (loading ||
      (authenticated && (phase === 'loading' || phase === 'connecting')))
  const closeHref = showConnected
    ? routes.dashboard.build()
    : routes.signIn.build()

  let description = t('connect.description.default')

  if (showError && errorMessage) {
    description = errorMessage
  } else if (isTimeTrackerError && errorMessage) {
    description = errorMessage
  } else if (showConnected) {
    description = t('connect.description.connected')
  } else if (isAuthError && errorMessage) {
    description = errorMessage
  }

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('connect.title')}
      />
      <CloseLink to={closeHref}>
        <IconButton variant="ghost" radius="full" color="gray" size="4">
          <Cross1Icon />
        </IconButton>
      </CloseLink>
      <S.Logo src={isDesktop ? LogoLabel : Logo} alt={t('signIn.logoAlt')} />
      <S.SignInCard>
        {showLoading && (
          <S.Overlay align="center" justify="center">
            <Spinner size={80} />
          </S.Overlay>
        )}
        <S.Title>{t('connect.heading')}</S.Title>
        {nonce ? (
          <>
            {showPairingMessage && !showConnected && (
              <S.Desc>{description}</S.Desc>
            )}
            {showConnected && (
              <Text size="5" as="p" align="center">
                <i>{t('connect.description.connected')}</i>
              </Text>
            )}
            {showWalletProviders && (
              <S.Actions>
                <AuthProviderButton
                  iconUrl={TonLogo}
                  iconAlt={t('signIn.alt.ton')}
                  onClick={() => onSignIn('ton')}
                >
                  {t('signIn.providers.ton')}
                </AuthProviderButton>
                <AuthProviderButton
                  iconUrl={SolanaLogo}
                  iconAlt={t('signIn.alt.solana')}
                  onClick={() => onSignIn('solana')}
                >
                  {t('signIn.providers.solana')}
                </AuthProviderButton>
                <AuthProviderButton
                  iconUrl={EthereumLogo}
                  iconAlt={t('signIn.alt.ethereum')}
                  onClick={() => onSignIn('eth')}
                >
                  {t('signIn.providers.ethereum')}
                </AuthProviderButton>
              </S.Actions>
            )}
          </>
        ) : (
          <S.Desc>
            <Trans
              i18nKey="connect.missingNonce"
              components={{ mb: <S.MobileBreak /> }}
            />
          </S.Desc>
        )}
      </S.SignInCard>
      <S.ButtonRow>
        <Button color="neutral" variant="soft" onClick={() => onSignIn('eth')}>
          {t('signIn.continue')}
        </Button>
      </S.ButtonRow>
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

const StatusNote = styled.p`
  margin-top: 20px;
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
    margin-top: 24px;
    font-size: var(--font-size-1);
  }
`
