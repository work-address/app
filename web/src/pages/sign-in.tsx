import { useUnit } from 'effector-react'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import {
  $authMethodsState,
  $authenticated,
  $googleClientId,
  fetchAuthMethodsFx,
  loginGoogleFx,
} from '@/entities/profile'
import { AuthGooglePanel, AuthSignInFoot } from '@/features/auth'
import { LocalWalletPanel, useLocalWalletFlow } from '@/features/local-wallet'
import { routes } from '@/routes'
import { Button, LogoLabel, PageHelmet, StateNotice } from '@/shared'

/**
 * Two equal halves, one for each way in: Google on the left, the browser wallet
 * run in place on the right. Where the deployment doesn't offer Google, the
 * wallet has the screen. While one way is busy the other is held back, and it
 * stays held back while a new wallet's key is on screen to be saved.
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
        <Header>
          <Logo src={LogoLabel} alt={t('signIn.logoAlt')} />
        </Header>
        <Heading>{t('signIn.heading')}</Heading>
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
                  <LocalWalletPanel flow={flow} />
                </Column>
              </Half>
            </>
          )}
        </Panels>
        {!failed && <Foot googleOffered={!!googleClientId} />}
      </Root>
    </>
  )
}

/* One column that scrolls on a phone. On a desktop the screen is pinned to the
   viewport and a half scrolls by itself if its form outgrows a short window.
   The tint is on the screen rather than the half so it also runs behind the
   foot, which belongs to both. */
const Root = styled.div`
  position: relative;
  width: 100%;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: var(--white);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    height: 100dvh;
    min-height: 0;
    grid-template-rows: minmax(0, 1fr) auto;
    overflow: hidden;

    &[data-layout='split']::before {
      content: '';
      position: absolute;
      inset: 0 0 0 50%;
      background: var(--ds-neutral-2);
    }
  }
`

const Header = styled.header`
  padding: var(--space-4);

  ${({ theme }) => theme.breakpoints.up('lg')} {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    padding: var(--space-5) var(--space-7);
  }
`

const Logo = styled.img`
  display: block;
  width: auto;
  height: 32px;
`

const Heading = styled.h1`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

const Panels = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  /* On a phone the wallet, stacked second, takes what's left, so its tint runs
     down to the foot. */
  grid-template-rows: auto;
  grid-auto-rows: 1fr;

  ${({ theme }) => theme.breakpoints.up('lg')} {
    min-height: 0;
    grid-template-rows: minmax(0, 1fr);

    ${Root}[data-layout='split'] & {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`

/* Both halves start on one line rather than being centred, so the headings stay
   level and the wallet's steps can change height without anything jumping. */
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
    min-height: 0;
    overflow-y: auto;
    padding: clamp(96px, 24dvh, 240px) var(--space-7) var(--space-6);

    &[data-side='wallet'] {
      background: none;
    }
  }
`

/* Above the screen's tint, which is what lets it run behind this. */
const Foot = styled(AuthSignInFoot)`
  position: relative;
`

const Column = styled.div`
  width: 100%;
  max-width: 400px;
  margin-inline: auto;
`
