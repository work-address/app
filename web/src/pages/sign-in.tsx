import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import type { SignInGuideMode } from '@/features/auth'

import { $authenticated, $pending } from '@/entities/profile'
import {
  AuthStyles as S,
  ETHEREUM_WALLETS,
  AuthHero,
  AuthProviders,
  AuthSignInGuide,
  AuthSignInGuideMobile,
  SOLANA_WALLETS,
  TON_WALLETS,
  AuthWalletList,
} from '@/features/auth'
import { routes } from '@/routes'
import { Logo as LogoImage, PageHelmet, Spinner } from '@/shared'

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
  const { t } = useTranslation()
  const loading = useUnit($pending)
  const authenticated = useUnit($authenticated)
  const [searchParams] = useSearchParams()
  const [guideMode, setGuideMode] = useState<SignInGuideMode>('default')
  const nonce = searchParams.get('nonce')

  if (nonce) {
    return <Navigate to={routes.connect.build({ nonce })} replace />
  }

  if (authenticated) {
    return <Navigate to={routes.dashboard.build()} />
  }

  const showHero = guideMode === 'default'

  const walletsFooter = (
    <>
      <FootTitle>{t('signIn.supportedWallets')}</FootTitle>
      {WALLET_LINES.map((line) => (
        <FootLine key={line.labelKey}>
          <S.FootLabel>{t(line.labelKey)}</S.FootLabel>{' '}
          <AuthWalletList wallets={line.wallets} breakAfter={Infinity} />
        </FootLine>
      ))}
      <Version>
        {t('signIn.version')}: {import.meta.env.VITE_GIT_COMMIT_SUFFIX}
      </Version>
    </>
  )

  return (
    <>
      <PageHelmet
        title={t('signIn.title')}
        description={t('signIn.meta')}
        noindex
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
          <Form
            onMouseLeave={(event) => {
              if (!event.currentTarget.contains(document.activeElement)) {
                setGuideMode('default')
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setGuideMode('default')
              }
            }}
          >
            <Heading>{t('signIn.heading')}</Heading>
            <Lead>{t('signIn.lead')}</Lead>
            <FieldLabel>{t('signIn.chooseNetwork')}</FieldLabel>
            <Providers>
              <AuthProviders onGuideChange={setGuideMode} />
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
          {/* Under the form while the page is one column; the brand panel
              carries it once there is one, so the form column never has to
              scroll on a desktop. */}
          <PanelFoot>{walletsFooter}</PanelFoot>
        </Panel>
        <Brand>
          <BrandInner>
            <BrandLayer
              data-visible={showHero || undefined}
              aria-hidden={!showHero}
              inert={!showHero}
            >
              <AuthHero />
            </BrandLayer>
            <BrandLayer
              data-visible={!showHero || undefined}
              aria-hidden={showHero}
              inert={showHero}
            >
              <AuthSignInGuide mode={guideMode} tone="dark" />
            </BrandLayer>
          </BrandInner>
          <BrandFoot>{walletsFooter}</BrandFoot>
        </Brand>
      </Screen>
    </>
  )
}

/* One column that scrolls on small screens; on a desktop the two panels are
   pinned to the viewport and nothing scrolls. */
const Screen = styled.div`
  width: 100%;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: var(--white);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
`

/* Hidden below `lg`: on a phone the brand copy would push the sign-in
   options below the fold, and the primer under the buttons covers the how-to. */
const Brand = styled.section`
  display: none;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
    padding: 48px 64px;
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

/* The hero and the guide share one grid cell, so the block is as tall as the
   taller of the two and the footer under it never moves when they swap. Both
   sit at the bottom of the cell, right above the footer. */
const BrandInner = styled.div`
  position: relative;
  display: grid;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
`

/* The wallet list at the foot of the brand panel, in the panel's own ink. */
/* Compact, and set on the same left edge as the hero so the two read as one
   block. Each network is one short line. */
const BrandFoot = styled.footer`
  position: relative;
  width: 100%;
  max-width: 520px;
  margin: 28px auto 0;
  padding-top: 16px;
  border-top: 1px solid var(--c-rgba-255-255-255-0_2);
  text-align: left;
  font-size: var(--font-size-0);
  line-height: 16px;
  color: var(--c-rgba-255-255-255-0_92);

  ${({ theme }) => theme.breakpoints.down('lg')} {
    display: none;
  }

  & span {
    color: var(--c-rgba-255-255-255-0_5);
  }

  a:hover {
    color: var(--white);
  }
`

/* The hero and the guide share one slot and crossfade, so the panel never
   jumps in height when the hover target changes. */
const BrandLayer = styled.div`
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.2s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
    height: 100%;
    padding: 24px 48px;
    /* The column itself scrolls only if a very short window cannot hold the
       form; the page never does. */
    overflow-y: auto;
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

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: none;
  }
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

  ${({ theme }) => theme.breakpoints.up('lg')} {
    display: none;
  }
`

const FootTitle = styled.div`
  font-size: var(--font-size-1);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: inherit;
  margin-bottom: 8px;
`

const FootLine = styled.div`
  margin-top: 2px;
`

const Version = styled.div`
  margin-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-0);
  opacity: 0.6;
`
