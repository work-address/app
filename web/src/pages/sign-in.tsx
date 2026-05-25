import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'

import type { LoginMode } from '@/entities/profile'

import {
  $authenticated,
  $pending,
  connectTimeTrackerFx,
  login,
} from '@/entities/profile'
import { AuthFormStyles as S, ProviderButton } from '@/features/auth'
import { routes } from '@/routes'
import {
  Button,
  PageHelmet,
  Spinner,
  useBreakpoint,
  Text,
  FEATURE_FLAGS,
} from '@/shared'

export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const loading = useUnit($pending)
  const authenticated = useUnit($authenticated)
  const isDesktop = useBreakpoint('isDesktop')
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')

  const navigate = useNavigate()

  const onSignIn = (mode: LoginMode) => {
    login(mode)
  }

  useEffect(() => {
    if (nonce) {
      void connectTimeTrackerFx(nonce)

      if (authenticated) {
        const timer = setTimeout(() => {
          navigate(routes.dashboard.build())
        }, 2000)

        return () => {
          clearTimeout(timer)
        }
      }
    }
  }, [nonce, navigate, authenticated])

  if (authenticated && !nonce) {
    return <Navigate to={routes.dashboard.build()} />
  }

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('signIn.title')}
      />

      <S.Logo
        src={
          isDesktop ? '/img/photo/address-work-logo.svg' : '/img/photo/logo.svg'
        }
        alt={t('signIn.logoAlt')}
      />

      {nonce && authenticated ? (
        <Text size="5">
          <i>{t('signIn.connected')}</i>
        </Text>
      ) : (
        <div />
      )}

      {!nonce && (
        <S.SignInCard>
          {loading && (
            <S.FlexOverlay align={'center'} justify={'center'}>
              <Spinner size={80} />
            </S.FlexOverlay>
          )}

          <S.Title>{t('signIn.title')}</S.Title>

          <S.Desc>
            <Trans
              i18nKey="signIn.description"
              components={{ mb: <S.MobileBreak /> }}
            />
          </S.Desc>

          <S.Actions>
            <ProviderButton
              iconUrl={'/img/photo/ethereum-logo.svg'}
              iconAlt={t('signIn.alt.ethereum')}
              onClick={() => onSignIn('eth')}
            >
              {t('signIn.providers.ethereum')}
            </ProviderButton>

            <ProviderButton
              iconUrl={'/img/photo/ton-logo.svg'}
              iconAlt={t('signIn.alt.ton')}
              onClick={() => onSignIn('ton')}
            >
              {t('signIn.providers.ton')}
            </ProviderButton>

            {FEATURE_FLAGS.SOLANA_ENABLED && (
              <ProviderButton
                iconUrl={'/img/photo/solana-logo.png'}
                iconAlt={t('signIn.alt.solana')}
                onClick={() => onSignIn('solana')}
              >
                {t('signIn.providers.solana')}
              </ProviderButton>
            )}
          </S.Actions>

          <S.Learn to={routes.docs.build()} target={routes.docs.target}>
            {t('signIn.learnMore')}
          </S.Learn>
        </S.SignInCard>
      )}

      {!nonce && (
        <S.Foot>
          <S.FootLine>
            <S.FootLabel>{t('signIn.footer.ethereumWallets')}</S.FootLabel>

            <Trans
              i18nKey="signIn.footer.ethereumWalletsList"
              components={{ db: <S.DesktopBreak /> }}
            />
          </S.FootLine>

          <S.FootLine>
            <S.FootLabel>{t('signIn.footer.tonWallets')}</S.FootLabel>

            <Trans
              i18nKey="signIn.footer.tonWalletsList"
              components={{ db: <S.DesktopBreak /> }}
            />
          </S.FootLine>

          <S.CommitSha>
            Version: {import.meta.env.VITE_GIT_COMMIT_SUFFIX}
          </S.CommitSha>
        </S.Foot>
      )}

      <S.HiddenButtonRow>
        <Button themeVariant="secondary" onClick={() => onSignIn('eth')}>
          {t('signIn.continue')}
        </Button>
      </S.HiddenButtonRow>
    </>
  )
}
