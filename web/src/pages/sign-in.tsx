import { useUnit } from 'effector-react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import type { LoginMode } from '@/entities/profile'

import { $authenticated, $pending, login } from '@/entities/profile'
import {
  AuthStyles as S,
  ETHEREUM_WALLETS,
  AuthProviderButton,
  SOLANA_WALLETS,
  TON_WALLETS,
  AuthWalletList,
} from '@/features/auth'
import { routes } from '@/routes'
import {
  Button,
  EthereumLogo,
  Logo,
  LogoLabel,
  PageHelmet,
  SolanaLogo,
  Spinner,
  TonLogo,
  useBreakpoint,
} from '@/shared'

export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const loading = useUnit($pending)
  const authenticated = useUnit($authenticated)
  const isDesktop = useBreakpoint('isDesktop')
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')

  if (nonce) {
    return <Navigate to={routes.connect.build({ nonce })} replace />
  }

  const onSignIn = (mode: LoginMode) => {
    login(mode)
  }

  if (authenticated) {
    return <Navigate to={routes.dashboard.build()} />
  }

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('signIn.title')}
      />
      <S.Logo src={isDesktop ? LogoLabel : Logo} alt={t('signIn.logoAlt')} />
      <S.SignInCard>
        {loading && (
          <S.Overlay align={'center'} justify={'center'}>
            <Spinner size={80} />
          </S.Overlay>
        )}
        <S.Title>{t('signIn.title')}</S.Title>
        <S.Desc>
          <Trans
            i18nKey="signIn.description"
            components={{ mb: <S.MobileBreak /> }}
          />
        </S.Desc>
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
        <S.Learn to={routes.docs.build()} target={routes.docs.target}>
          {t('signIn.learnMore')}
        </S.Learn>
      </S.SignInCard>
      <Footer>
        <S.FootLine>
          <S.FootLabel>{t('signIn.footer.ethereumWallets')}</S.FootLabel>{' '}
          <AuthWalletList wallets={ETHEREUM_WALLETS} />
        </S.FootLine>
        <S.FootLine>
          <S.FootLabel>{t('signIn.footer.tonWallets')}</S.FootLabel>{' '}
          <AuthWalletList wallets={TON_WALLETS} />
        </S.FootLine>
        <S.FootLine>
          <S.FootLabel>{t('signIn.footer.solanaWallets')}</S.FootLabel>{' '}
          <AuthWalletList wallets={SOLANA_WALLETS} breakAfter={3} />
        </S.FootLine>
        <CommitSha>Version: {import.meta.env.VITE_GIT_COMMIT_SUFFIX}</CommitSha>
      </Footer>
      <S.ButtonRow>
        <Button color="neutral" variant="soft" onClick={() => onSignIn('eth')}>
          {t('signIn.continue')}
        </Button>
      </S.ButtonRow>
    </>
  )
}

const Footer = styled.footer`
  text-align: center;
  font-size: var(--font-size-1);
  color: var(--c-rgba-0-7-20-0_52);
  letter-spacing: 0.55px;
  font-weight: 500;
  margin-left: -2px;
  margin-top: 20px;
  line-height: 16px;
  padding-bottom: 40px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: var(--font-size-2);
    margin-top: 20px;
    line-height: 20px;
  }
`

const CommitSha = styled.div`
  margin-top: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-0);
  font-weight: 400;
  color: var(--c-rgba-0-7-20-0_38);
  letter-spacing: 0.2px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-top: 21px;
    font-size: var(--font-size-1);
  }
`
