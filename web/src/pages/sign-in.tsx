import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import type { LoginMode } from '@/entities/profile'
import type { SignInGuideMode } from '@/features/auth'

import { $authenticated, $pending, login } from '@/entities/profile'
import {
  AuthStyles as S,
  ETHEREUM_WALLETS,
  AuthHero,
  AuthProviderButton,
  AuthSignInGuide,
  AuthSignInGuideMobile,
  SOLANA_WALLETS,
  TON_WALLETS,
  AuthWalletList,
} from '@/features/auth'
import { routes } from '@/routes'
import {
  EthereumLogo,
  Logo as LogoImage,
  PageHelmet,
  SolanaLogo,
  Spinner,
  TonLogo,
} from '@/shared'

const WALLET_LINES = [
  { labelKey: 'signIn.footer.ethereumWallets', wallets: ETHEREUM_WALLETS },
  { labelKey: 'signIn.footer.tonWallets', wallets: TON_WALLETS },
  { labelKey: 'signIn.footer.solanaWallets', wallets: SOLANA_WALLETS },
]

/**
 * Split sign-in: the choice of network on the left, laid out like a sign-in
 * form, and the brand panel on the right. Hovering a network swaps the brand
 * panel for that network's steps, so the explanation sits beside the button
 * it explains rather than under it. Below `lg` the brand panel goes and the
 * steps become the collapsible primer under the buttons.
 */
export default function SignInPage() {
  const { t, i18n } = useTranslation()
  const loading = useUnit($pending)
  const authenticated = useUnit($authenticated)
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

  const showHero = guideMode === 'default'

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('signIn.title')}
      />
      <Screen>
        <Panel>
          {loading && (
            <S.Overlay align={'center'} justify={'center'}>
              <Spinner size={80} />
            </S.Overlay>
          )}
          <PanelTop>
            <Logo src={LogoImage} alt={t('signIn.logoAlt')} />
          </PanelTop>
          <Form onMouseLeave={() => setGuideMode('default')}>
            <Heading>{t('signIn.heading')}</Heading>
            <Lead>{t('signIn.lead')}</Lead>
            <FieldLabel>{t('signIn.chooseNetwork')}</FieldLabel>
            <Providers>
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
            </Providers>
            <Primer>
              <AuthSignInGuideMobile />
            </Primer>
            <Divider role="separator" />
            <Secondary>
              {t('signIn.noAccount')}{' '}
              <S.Learn to={routes.docs.build()} target={routes.docs.target}>
                {t('signIn.learnMore')}
              </S.Learn>
            </Secondary>
          </Form>
          <PanelFoot>
            <FootTitle>{t('signIn.supportedWallets')}</FootTitle>
            {WALLET_LINES.map((line) => (
              <FootLine key={line.labelKey}>
                <S.FootLabel>{t(line.labelKey)}</S.FootLabel>{' '}
                <AuthWalletList wallets={line.wallets} breakAfter={Infinity} />
              </FootLine>
            ))}
            <Version>Version: {import.meta.env.VITE_GIT_COMMIT_SUFFIX}</Version>
          </PanelFoot>
        </Panel>
        <Brand>
          <BrandInner>
            <BrandLayer data-visible={showHero || undefined}>
              <AuthHero />
            </BrandLayer>
            <BrandLayer data-visible={!showHero || undefined}>
              <AuthSignInGuide mode={guideMode} tone="dark" />
            </BrandLayer>
          </BrandInner>
        </Brand>
      </Screen>
    </>
  )
}

const Screen = styled.div`
  width: 100%;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: var(--white);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
`

/* Hidden below `lg`: on a phone the brand copy would push the sign-in
   options below the fold, and the primer under the buttons covers the how-to. */
const Brand = styled.section`
  display: none;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    position: relative;
    display: flex;
    align-items: center;
    padding: 64px;
    overflow: hidden;
    color: var(--white);
    background: linear-gradient(
      160deg,
      var(--ds-accent-9) 0%,
      var(--c-253854) 100%
    );

    /* Two soft arcs, the way the reference panel breaks up a flat field of
       colour without an illustration to maintain. */
    &::before,
    &::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      background: var(--c-rgba-255-255-255-0_2);
      opacity: 0.35;
      pointer-events: none;
    }

    &::before {
      width: 620px;
      height: 620px;
      right: -260px;
      top: -300px;
    }

    &::after {
      width: 420px;
      height: 420px;
      left: -200px;
      bottom: -240px;
      opacity: 0.25;
    }
  }
`

const BrandInner = styled.div`
  position: relative;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  min-height: 460px;
`

/* The hero and the guide share one slot and crossfade, so the panel never
   jumps in height when the hover target changes. */
const BrandLayer = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;

  &[data-visible] {
    opacity: 1;
    pointer-events: auto;
  }
`

const Panel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 24px 16px 28px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    padding: 28px 40px 32px;
  }

  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 0;
    padding: 28px 48px 28px;
  }
`

const PanelTop = styled.div`
  display: flex;
  justify-content: center;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    justify-content: flex-start;
  }
`

const Logo = styled.img`
  display: block;
  width: 64px;
  height: 64px;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    width: 56px;
    height: 56px;
  }
`

/* Under the logo on a phone, the way a form follows a header; centred in the
   panel on a desktop, level with the brand copy beside it. */
const Form = styled.div`
  width: 100%;
  max-width: 456px;
  margin: 36px auto 0;
  display: flex;
  flex-direction: column;
  text-align: left;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    flex: 1;
    justify-content: center;
    margin-top: 24px;
  }
`

const Heading = styled.h1`
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--ds-neutral-12);
  margin: 0 0 10px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    font-size: 32px;
  }
`

const Lead = styled.p`
  font-size: var(--font-size-3);
  line-height: 1.5;
  color: var(--ds-neutral-11);
  margin: 0 0 28px;
`

/* The reference's uppercase field caption - here it names the choice below. */
const FieldLabel = styled.div`
  font-size: var(--font-size-1);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ds-neutral-11);
  margin-bottom: 8px;
`

const Providers = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const Primer = styled.div`
  margin-top: 14px;
`

const Divider = styled.hr`
  border: 0;
  border-top: 1px solid var(--ds-neutral-alpha-6);
  margin: 22px 0;
`

const Secondary = styled.p`
  margin: 0;
  text-align: center;
  font-size: var(--font-size-2);
  line-height: 1.5;
  color: var(--ds-neutral-11);
`

const PanelFoot = styled.footer`
  width: 100%;
  max-width: 456px;
  margin: auto auto 0;
  padding-top: 36px;
  text-align: center;
  font-size: var(--font-size-1);
  line-height: 18px;
  color: var(--ds-neutral-11);
`

const FootTitle = styled.div`
  font-size: var(--font-size-1);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ds-neutral-11);
  margin-bottom: 8px;
`

const FootLine = styled.div`
  margin-top: 4px;
`

const Version = styled.div`
  margin-top: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-0);
  color: var(--c-rgba-0-7-20-0_38);
`
