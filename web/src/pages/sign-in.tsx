import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import {
  $authMethodsState,
  $authenticated,
  $googleClientId,
  fetchAuthMethodsFx,
  loginGoogleFx,
} from '@/entities/profile'
import { AuthGooglePanel, AuthStyles, AuthWalletPanel } from '@/features/auth'
import { useLocalWalletFlow } from '@/features/local-wallet'
import { routes } from '@/routes'
import { Button, LogoLabel, PageHelmet, StateNotice } from '@/shared'

/**
 * A band that says what this is, then two equal halves, one for each way in,
 * centred in the room left: Google on the left,
 * the browser wallet run in place on the right. Where the deployment doesn't
 * offer Google, the wallet has the room. While one way is busy the other is held
 * back, and it stays held back while a new wallet's key is on screen to be saved.
 */
export default function SignInPage() {
  const { t } = useTranslation()
  const {
    authenticated,
    googleClientId,
    methodsState,
    googleSigningIn,
    fetchMethods,
  } = useUnit({
    authenticated: $authenticated,
    googleClientId: $googleClientId,
    methodsState: $authMethodsState,
    googleSigningIn: loginGoogleFx.pending,
    fetchMethods: fetchAuthMethodsFx,
  })
  const flow = useLocalWalletFlow()
  const version = import.meta.env.VITE_GIT_COMMIT_SUFFIX
  const [searchParams] = useSearchParams()
  const nonce = searchParams.get('nonce')

  const loadMethods = useCallback(() => {
    fetchMethods().catch(() => {})
  }, [fetchMethods])

  useEffect(loadMethods, [loadMethods])

  if (nonce) {
    return <Navigate to={routes.connect.build({ nonce })} replace />
  }

  if (authenticated) {
    return <Navigate to={routes.dashboard.build()} />
  }

  const failed = methodsState === 'failed'
  const split =
    methodsState === 'loading' || (methodsState === 'ready' && !!googleClientId)
  const googleHeld = flow.busy || flow.step === 'backup'

  return (
    <>
      <PageHelmet title={t('signIn.title')} description={t('signIn.meta')} />
      <Root data-layout={split ? 'split' : 'single'}>
        <Band>
          <BandContent>
            <BandTop>
              <Logo src={LogoLabel} alt={t('signIn.logoAlt')} />
              <BandActions>
                {version && (
                  <Version>
                    {t('signIn.version')} {version}
                  </Version>
                )}
                <Help to={routes.docs.build()} target={routes.docs.target}>
                  <QuestionMarkCircledIcon aria-hidden="true" />
                  {t('signIn.learnMore')}
                </Help>
              </BandActions>
            </BandTop>
            <Intro>
              <Title>{t('signIn.hero.title')}</Title>
              <Subtitle>{t('signIn.hero.subtitle')}</Subtitle>
            </Intro>
          </BandContent>
        </Band>
        <Panels>
          {failed ? (
            <Half>
              <Column>
                {/* The wallet signs in through the same API, so it can't be
                    offered as a way round this. */}
                <StateNotice
                  tone="error"
                  title={t('signIn.unavailable.title')}
                  description={t('signIn.unavailable.description')}
                  actions={
                    <Button onClick={loadMethods}>
                      {t('signIn.googleRetry')}
                    </Button>
                  }
                />
              </Column>
            </Half>
          ) : (
            <>
              {split && (
                <Half data-held={googleHeld || undefined} inert={googleHeld}>
                  <Column>
                    <AuthGooglePanel clientId={googleClientId} />
                  </Column>
                </Half>
              )}
              <Half
                data-side="wallet"
                data-held={googleSigningIn || undefined}
                inert={googleSigningIn}
              >
                <Column>
                  <AuthWalletPanel flow={flow} choosing={split} />
                </Column>
              </Half>
            </>
          )}
        </Panels>
      </Root>
    </>
  )
}

/* One column that scrolls on a phone. On a desktop the screen is pinned to the
   viewport, and only the panels scroll if a form outgrows a short window. */
const Root = styled.div`
  width: 100%;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--white);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    height: 100dvh;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }
`

const Band = styled.header`
  padding: var(--space-4);
  color: var(--white);
  background: linear-gradient(
    100deg,
    var(--ds-accent-11) 0%,
    var(--c-253854) 100%
  );

  ${({ theme }) => theme.breakpoints.up('lg')} {
    padding: var(--space-5) var(--space-7) var(--space-6);
  }
`

const BandContent = styled(AuthStyles.Frame)`
  display: grid;
  gap: var(--space-5);
`

const BandTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
`

/* The wordmark is one flat colour, so this turns it white for the band. */
const Logo = styled.img`
  display: block;
  width: auto;
  height: 26px;
  filter: brightness(0) invert(1);
`

const BandActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-4);
`

const Version = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-0);
  white-space: nowrap;
  color: var(--c-rgba-255-255-255-0_5);

  ${({ theme }) => theme.breakpoints.down('lg')} {
    display: none;
  }
`

const Help = styled(Link)`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--c-rgba-255-255-255-0_5);
  border-radius: var(--radius-2);
  font-size: var(--font-size-2);
  font-weight: 500;
  color: var(--white);
  text-decoration: none;
  transition: background 0.15s ease;

  &:hover {
    background: var(--c-rgba-255-255-255-0_2);
  }

  &:focus-visible {
    outline: 2px solid var(--white);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Intro = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  text-align: center;
`

const Title = styled.h1`
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--white);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    /* Stays on one line in the band's first column at any desktop width. */
    font-size: clamp(28px, 2.6vw, 36px);
  }
`

const Subtitle = styled.p`
  margin: 0;
  max-width: 72ch;
  text-wrap: balance;
  font-size: var(--font-size-3);
  line-height: 1.5;
  color: var(--c-rgba-255-255-255-0_92);
`

/* On a desktop the halves share one row, centred between two spacer rows that
   collapse when a form outgrows a short window, which then scrolls. One row keeps
   the two headings level, and centring it keeps them level whatever the wallet's
   step. The tint is the background so it fills the height, whatever the row's. */
const Panels = styled.main`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  /* On a phone the wallet, stacked second, takes what's left. */
  grid-template-rows: auto;
  grid-auto-rows: 1fr;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 0;
    overflow-y: auto;
    grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr);
    grid-auto-rows: auto;

    ${Root}[data-layout='split'] & {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      background: linear-gradient(
        to right,
        transparent 50%,
        var(--ds-neutral-2) 50%
      );
    }
  }
`

const Half = styled.section`
  padding: var(--space-6) var(--space-4);
  transition: opacity 0.2s ease;

  &[data-side='wallet'] {
    background: var(--ds-neutral-2);
  }

  ${Root}[data-layout='single'] &[data-side='wallet'] {
    background: none;
  }

  &[data-held] {
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  ${({ theme }) => theme.breakpoints.up('lg')} {
    grid-row: 2;
    padding: var(--space-5) var(--space-7);

    &[data-side='wallet'] {
      background: none;
    }
  }
`

const Column = styled.div`
  width: 100%;
  max-width: 400px;
  margin-inline: auto;
`
