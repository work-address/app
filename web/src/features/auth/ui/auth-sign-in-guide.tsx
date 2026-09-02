import { ChevronDownIcon } from '@radix-ui/react-icons'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ETHEREUM_WALLETS, SOLANA_WALLETS, TON_WALLETS } from '../model'

import { AuthWalletList } from './auth-wallet-list'

import type { SupportedWallet } from '../model'

export type SignInGuideMode = 'default' | 'ton' | 'solana' | 'eth' | 'local'

type PanelSpec = {
  mode: SignInGuideMode
  stepCount: number
  wallets?: SupportedWallet[]
}

const PANELS: PanelSpec[] = [
  { mode: 'default', stepCount: 3 },
  { mode: 'ton', stepCount: 4, wallets: TON_WALLETS },
  { mode: 'solana', stepCount: 4, wallets: SOLANA_WALLETS },
  { mode: 'eth', stepCount: 4, wallets: ETHEREUM_WALLETS },
  { mode: 'local', stepCount: 4 },
]

type Props = {
  mode: SignInGuideMode
  /**
   * `dark` sets the guide on the brand panel, where the copy has to be
   * white on blue; `light` keeps the default ink for a pale surface.
   */
  tone?: 'light' | 'dark'
}

export const AuthSignInGuide = ({ mode, tone = 'light' }: Props) => {
  const { t } = useTranslation()

  return (
    <Root data-tone={tone}>
      {PANELS.map((panel) => {
        const active = panel.mode === mode

        return (
          <Panel key={panel.mode} $active={active} aria-hidden={!active}>
            <Eyebrow>{t('signIn.guide.eyebrow')}</Eyebrow>
            <PanelTitle>{t(`signIn.guide.${panel.mode}.title`)}</PanelTitle>
            {panel.mode === 'default' && (
              <Intro>{t('signIn.guide.default.intro')}</Intro>
            )}
            <Steps>
              {Array.from({ length: panel.stepCount }, (_, index) => (
                <Step key={index}>
                  <StepBadge>{index + 1}</StepBadge>
                  <StepText>
                    {t(`signIn.guide.${panel.mode}.step${index + 1}`)}
                  </StepText>
                </Step>
              ))}
            </Steps>
            {panel.wallets ? (
              <Wallets>
                <WalletsLabel>{t('signIn.guide.walletsLabel')}</WalletsLabel>{' '}
                <AuthWalletList wallets={panel.wallets} breakAfter={Infinity} />
              </Wallets>
            ) : (
              <Hint>{t('signIn.guide.default.hint')}</Hint>
            )}
            <Note>{t('signIn.guide.free')}</Note>
          </Panel>
        )
      })}
    </Root>
  )
}

const MOBILE_STEP_COUNT = 3

// Touch screens have no hover, so below `lg` the guide becomes this
// tap-to-expand primer inside the sign-in card. The steps skip the QR code:
// on a phone the wallet opens directly instead of being scanned.
export const AuthSignInGuideMobile = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const contentId = useId()

  return (
    <MobileRoot>
      <MobileToggle
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        {t('signIn.guide.default.title')}
        <MobileChevron $open={open} aria-hidden />
      </MobileToggle>
      <MobileCollapse id={contentId} $open={open}>
        <MobileCollapseInner>
          <Steps>
            {Array.from({ length: MOBILE_STEP_COUNT }, (_, index) => (
              <Step key={index}>
                <StepBadge>{index + 1}</StepBadge>
                <StepText>{t(`signIn.guide.mobile.step${index + 1}`)}</StepText>
              </Step>
            ))}
          </Steps>
          <Note>{t('signIn.guide.free')}</Note>
        </MobileCollapseInner>
      </MobileCollapse>
    </MobileRoot>
  )
}

/* The palette is a set of variables so the two tones share one markup. */
const Root = styled.div`
  position: relative;
  height: 100%;
  min-height: 460px;

  --guide-eyebrow: var(--ds-accent-9);
  --guide-title: var(--ds-neutral-12);
  --guide-text: var(--c-rgba-0-7-20-0_82);
  --guide-muted: var(--c-rgba-0-7-20-0_52);
  --guide-note: var(--ds-accent-11);
  --guide-rule: var(--c-rgba-0-0-51-0_12);
  --guide-badge-bg: var(--white);
  --guide-badge-fg: var(--ds-accent-11);
  --guide-badge-border: var(--c-rgba-0-0-51-0_12);

  &[data-tone='dark'] {
    --guide-eyebrow: var(--c-rgba-255-255-255-0_92);
    --guide-title: var(--white);
    --guide-text: var(--c-rgba-255-255-255-0_92);
    --guide-muted: var(--c-rgba-255-255-255-0_5);
    --guide-note: var(--c-rgba-255-255-255-0_92);
    --guide-rule: var(--c-rgba-255-255-255-0_2);
    --guide-badge-bg: var(--c-rgba-255-255-255-0_2);
    --guide-badge-fg: var(--white);
    --guide-badge-border: transparent;
  }
`

const MobileRoot = styled.div`
  width: 100%;
`

const MobileToggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 40px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: var(--font-size-2);
  font-weight: 500;
  color: var(--ds-accent-11);

  &:hover {
    background: var(--ds-accent-3);
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`

const MobileChevron = styled(ChevronDownIcon)<{ $open: boolean }>`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
  transform: rotate(${({ $open }) => ($open ? 180 : 0)}deg);
`

const MobileCollapse = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? '1fr' : '0fr')};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transition:
    grid-template-rows 0.25s ease,
    visibility 0.25s;
`

const MobileCollapseInner = styled.div`
  overflow: hidden;
  min-height: 0;
  text-align: left;
  padding: 0 4px;
`

const Panel = styled.div<{ $active: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0;
  text-align: left;
  opacity: ${({ $active }) => ($active ? 1 : 0)};
  transition: opacity 0.2s ease;
  pointer-events: ${({ $active }) => ($active ? 'auto' : 'none')};
`

const Eyebrow = styled.div`
  font-size: var(--font-size-1);
  font-weight: 600;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--guide-eyebrow);
  margin-bottom: 10px;
`

const PanelTitle = styled.h2`
  font-size: var(--font-size-5);
  font-weight: 500;
  letter-spacing: 0.4px;
  color: var(--guide-title);
  line-height: 28px;
  margin-bottom: 8px;
`

const Intro = styled.p`
  font-size: var(--font-size-2);
  color: var(--guide-text);
  line-height: 20px;
  letter-spacing: 0.3px;
  margin-bottom: 10px;
`

const Steps = styled.ol`
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
`

const Step = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
`

const StepBadge = styled.span`
  flex: 0 0 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--guide-badge-bg);
  border: 1px solid var(--guide-badge-border);
  color: var(--guide-badge-fg);
  font-size: var(--font-size-1);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -2px;
`

const StepText = styled.span`
  font-size: var(--font-size-2);
  line-height: 20px;
  letter-spacing: 0.3px;
  color: var(--guide-text);
`

const Wallets = styled.div`
  margin-top: 8px;
  font-size: var(--font-size-1);
  line-height: 18px;
  letter-spacing: 0.4px;
  color: var(--guide-muted);

  a:hover {
    color: var(--guide-title);
  }
`

const WalletsLabel = styled.span`
  font-weight: 300;
`

const Hint = styled.div`
  margin-top: 8px;
  font-size: var(--font-size-1);
  line-height: 18px;
  letter-spacing: 0.4px;
  color: var(--guide-muted);
`

const Note = styled.div`
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--guide-rule);
  font-size: var(--font-size-1);
  line-height: 18px;
  letter-spacing: 0.4px;
  color: var(--guide-note);
`
