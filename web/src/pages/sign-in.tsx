import { useUnit } from 'effector-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import type { LoginMode } from '@/entities/profile'
import type { SignInGuideMode } from '@/features/auth'

import { $authenticated, $pending, login } from '@/entities/profile'
import {
  AuthStyles as S,
  ETHEREUM_WALLETS,
  AuthProviderButton,
  AuthSignInGuide,
  AuthSignInGuideMobile,
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

const WALLET_LINES = [
  { labelKey: 'signIn.footer.ethereumWallets', wallets: ETHEREUM_WALLETS },
  { labelKey: 'signIn.footer.tonWallets', wallets: TON_WALLETS },
  {
    labelKey: 'signIn.footer.solanaWallets',
    wallets: SOLANA_WALLETS,
    mobileBreakAfter: 3,
  },
]

export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const loading = useUnit($pending)
  const authenticated = useUnit($authenticated)
  const isDesktop = useBreakpoint('isDesktop')
  const [searchParams] = useSearchParams()
  const [guideMode, setGuideMode] = useState<SignInGuideMode>('default')
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

  const providers = [
    {
      mode: 'ton',
      iconUrl: TonLogo,
      iconAlt: t('signIn.alt.ton'),
      label: t('signIn.providers.ton'),
    },
    {
      mode: 'solana',
      iconUrl: SolanaLogo,
      iconAlt: t('signIn.alt.solana'),
      label: t('signIn.providers.solana'),
    },
    {
      mode: 'eth',
      iconUrl: EthereumLogo,
      iconAlt: t('signIn.alt.ethereum'),
      label: t('signIn.providers.ethereum'),
    },
  ] satisfies {
    mode: LoginMode
    iconUrl: string
    iconAlt: string
    label: string
  }[]

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('signIn.title')}
      />
      <Screen>
        <S.Logo src={isDesktop ? LogoLabel : Logo} alt={t('signIn.logoAlt')} />
        <Shell>
          {loading && (
            <S.Overlay align={'center'} justify={'center'}>
              <Spinner size={80} />
            </S.Overlay>
          )}
          <MainPane>
            <S.Title>{t('signIn.title')}</S.Title>
            <S.Desc>
              <Trans
                i18nKey="signIn.description"
                components={{ mb: <S.MobileBreak /> }}
              />
            </S.Desc>
            <S.Actions onMouseLeave={() => setGuideMode('default')}>
              {providers.map((provider) => (
                <AuthProviderButton
                  key={provider.mode}
                  iconUrl={provider.iconUrl}
                  iconAlt={provider.iconAlt}
                  onClick={() => onSignIn(provider.mode)}
                  onMouseEnter={() => setGuideMode(provider.mode)}
                  onFocus={() => setGuideMode(provider.mode)}
                >
                  {provider.label}
                </AuthProviderButton>
              ))}
            </S.Actions>
            <AuthSignInGuideMobile />
            <S.Learn to={routes.docs.build()} target={routes.docs.target}>
              {t('signIn.learnMore')}
            </S.Learn>
          </MainPane>
          <GuidePane>
            <AuthSignInGuide mode={guideMode} />
          </GuidePane>
        </Shell>
        <Footer>
          {WALLET_LINES.map((line) => (
            <S.FootLine key={line.labelKey}>
              <S.FootLabel>{t(line.labelKey)}</S.FootLabel>{' '}
              <AuthWalletList
                wallets={line.wallets}
                breakAfter={line.mobileBreakAfter ?? 4}
              />
            </S.FootLine>
          ))}
          <CommitSha>
            Version: {import.meta.env.VITE_GIT_COMMIT_SUFFIX}
          </CommitSha>
        </Footer>
        <DesktopFooter>
          {WALLET_LINES.map((line) => (
            <DesktopFootLine key={line.labelKey}>
              <S.FootLabel>{t(line.labelKey)}</S.FootLabel>{' '}
              <AuthWalletList wallets={line.wallets} breakAfter={Infinity} />
            </DesktopFootLine>
          ))}
        </DesktopFooter>
        <DesktopVersion>
          Version: {import.meta.env.VITE_GIT_COMMIT_SUFFIX}
        </DesktopVersion>
        <S.ButtonRow>
          <Button
            color="neutral"
            variant="soft"
            onClick={() => onSignIn('eth')}
          >
            {t('signIn.continue')}
          </Button>
        </S.ButtonRow>
      </Screen>
    </>
  )
}

const Screen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    width: 100%;
    height: 100dvh;
    justify-content: center;
    overflow: hidden;
  }
`

// Below `lg` the shell is exactly the old sign-in card; on large screens it
// splits into the sign-in pane on the left and the how-to guide on the right.
const Shell = styled(S.SignInCard)`
  ${({ theme }) => theme.breakpoints.up('lg')} {
    width: min(1040px, calc(100vw - 96px));
    display: grid;
    grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr);
    padding: 0;
    overflow: hidden;
  }
`

const MainPane = styled.div`
  display: contents;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding: 44px 48px 34px;
  }
`

const GuidePane = styled.aside`
  display: none;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: block;
    min-width: 0;
    background: var(--ds-accent-3);
    border-left: 1px solid var(--c-rgba-0-0-51-0_12);
  }
`

const Footer = styled.footer`
  text-align: center;
  font-size: var(--font-size-1);
  color: var(--c-rgba-0-7-20-0_52);
  letter-spacing: 0.55px;
  font-weight: 500;
  margin-left: -2px;
  margin-top: 20px;
  line-height: 22px;
  padding-bottom: 40px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: var(--font-size-2);
    margin-top: 20px;
    line-height: 20px;
  }

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: none;
  }
`

// Compact desktop counterpart of the wallet-list footer. Hidden on short
// viewports so the full-screen page never scrolls; the hover guide still
// lists each network's wallets there.
const DesktopFooter = styled.footer`
  display: none;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    @media (min-height: 780px) {
      display: block;
      margin-top: 18px;
      text-align: center;
      font-size: var(--font-size-1);
      color: var(--c-rgba-0-7-20-0_52);
      letter-spacing: 0.45px;
      font-weight: 500;
      line-height: 18px;
    }
  }
`

const DesktopFootLine = styled.div`
  margin-top: 5px;

  &:first-child {
    margin-top: 0;
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

const DesktopVersion = styled(CommitSha)`
  display: none;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: block;
    margin-top: 18px;
  }
`
