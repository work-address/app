import { Helmet } from 'react-helmet-async'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import { AuthFormStyles as S, ProviderButton } from '@/features/auth'
import { Button, routes, showToast } from '@/features/shared'

export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { breakpoints } = useTheme()

  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const onSignIn = (type: 'ton' | 'eth') => {
    if (type === 'ton') {
      navigate(routes.dashboard.schema)
    } else {
      showToast('error', {
        title: t('signIn.error.title'),
        message: t('signIn.error.message'),
        position: 'top-center',
      })
    }
  }

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('signIn.title')}
      />
      {isUpMd ? (
        <S.Logo src="/img/photo/logo.svg" alt={t('signIn.logoAlt')} />
      ) : (
        <S.Logo src="/img/photo/logo.svg" alt={t('signIn.logoAlt')} />
      )}

      <S.SignInCard>
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
