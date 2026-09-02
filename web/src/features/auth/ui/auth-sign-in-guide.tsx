import { ChevronDownIcon } from '@radix-ui/react-icons'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export type SignInGuideMode = 'default' | 'ton' | 'solana' | 'eth' | 'local'

type PanelSpec = {
  mode: SignInGuideMode
  stepCount: number
}

const PANELS: PanelSpec[] = [
  { mode: 'default', stepCount: 3 },
  { mode: 'ton', stepCount: 4 },
  { mode: 'solana', stepCount: 4 },
  { mode: 'eth', stepCount: 4 },
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
            {/* No wallet list here: the caption under the panel already names
                every supported wallet, and saying it twice on one screen read
                as clutter. */}
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
    /* No rule of its own on the brand panel; the wallet caption below has one. */
    --guide-rule: transparent;
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

/* Set like the hero title it stands in for, so hovering a network swaps the
   words and nothing else. */
const PanelTitle = styled.h2`
  font-size: 44px;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: var(--guide-title);
  margin: 0 0 18px;
  text-wrap: balance;

  @media (min-width: 1280px) {
    font-size: 52px;
  }
`

const Intro = styled.p`
  font-size: var(--font-size-4);
  color: var(--guide-text);
  line-height: 1.5;
  max-width: 34ch;
  margin: 0;
`

const Steps = styled.ol`
  list-style: none;
  margin: 14px 0 0;
  padding: 0;

  ${Root} & {
    margin-top: 36px;
    font-size: var(--font-size-3);
    line-height: 1.5;
  }
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

  ${Root} & {
    font-size: inherit;
    line-height: inherit;
    letter-spacing: 0;
  }
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
