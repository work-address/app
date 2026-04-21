import { useUnit } from 'effector-react'
import { Helmet } from 'react-helmet-async'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { LoginMode } from '@/entities/profile'

import { $authenticated, $pending, login } from '@/entities/profile'
import { AuthFormStyles as S, ProviderButton } from '@/features/auth'
import { Button, routes, Spinner, useBreakpoint } from '@/features/shared'

export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const loading = useUnit($pending)
  const authenticated = useUnit($authenticated)
  const isDesktop = useBreakpoint('isDesktop')
  const navigate = useNavigate()

  const onSignIn = (mode: LoginMode) => {
    login(mode)
  }

  if (authenticated) {
    navigate(routes.dashboard.schema)
    return null
  }

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('signIn.title')}
      />

      <S.Logo
        src={isDesktop ? '/img/photo/logo.svg' : '/img/photo/logo.svg'}
        alt={t('signIn.logoAlt')}
      />

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
        </S.Actions>

        <S.Learn href={'#'} target={'_blank'}>
          {t('signIn.learnMore')}
        </S.Learn>
      </S.SignInCard>

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
      </S.Foot>

      <S.HiddenButtonRow>
        <Button themeVariant="secondary" onClick={() => onSignIn('eth')}>
          {t('signIn.continue')}
        </Button>
      </S.HiddenButtonRow>
    </>
  )
}
