import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ETHEREUM_WALLETS, SOLANA_WALLETS, TON_WALLETS } from '../model'

import { AuthWalletList } from './auth-wallet-list'

import type { SupportedWallet } from '../model'

export type SignInGuideMode = 'default' | 'ton' | 'solana' | 'eth'

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
]

type Props = {
  mode: SignInGuideMode
}

export const AuthSignInGuide = ({ mode }: Props) => {
  const { t } = useTranslation()

  return (
    <Root>
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

const Root = styled.div`
  position: relative;
  height: 100%;
  min-height: 460px;
`

const Panel = styled.div<{ $active: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px 44px;
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
  color: var(--ds-accent-9);
  margin-bottom: 10px;
`

const PanelTitle = styled.h2`
  font-size: var(--font-size-5);
  font-weight: 500;
  letter-spacing: 0.4px;
  color: var(--ds-neutral-12);
  line-height: 28px;
  margin-bottom: 8px;
`

const Intro = styled.p`
  font-size: var(--font-size-2);
  color: var(--c-rgba-0-7-20-0_62);
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
  background: var(--white);
  border: 1px solid var(--c-rgba-0-0-51-0_12);
  color: var(--ds-accent-11);
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
  color: var(--c-rgba-0-7-20-0_82);
`

const Wallets = styled.div`
  margin-top: 8px;
  font-size: var(--font-size-1);
  line-height: 18px;
  letter-spacing: 0.4px;
  color: var(--c-rgba-0-7-20-0_52);
`

const WalletsLabel = styled.span`
  font-weight: 300;
`

const Hint = styled.div`
  margin-top: 8px;
  font-size: var(--font-size-1);
  line-height: 18px;
  letter-spacing: 0.4px;
  color: var(--c-rgba-0-7-20-0_52);
`

const Note = styled.div`
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--c-rgba-0-0-51-0_12);
  font-size: var(--font-size-1);
  line-height: 18px;
  letter-spacing: 0.4px;
  color: var(--ds-accent-11);
`
