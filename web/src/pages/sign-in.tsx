import { useUnit } from 'effector-react'
import { Helmet } from 'react-helmet-async'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { AuthFormStyles as S, ProviderButton, authModel } from '@/features/auth'
import { Button, routes, Spinner, useBreakpoint } from '@/features/shared'

export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const loading = useUnit(authModel.$pending)
  const authenticated = useUnit(authModel.$authenticated)
  const isDesktop = useBreakpoint('isDesktop')

  const onSignIn = (type: authModel.LoginMode) => {
    authModel.login(type)
  }

  if (authenticated) {
    return <Navigate to={routes.dashboard.schema} />
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
