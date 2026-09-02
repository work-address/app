import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $localWalletPhase } from '../model'

import { Spinner, Text } from '@/shared'

/**
 * One line saying what the wallet is doing right now. Shown wherever a form
 * is waiting on the key: generating and encrypting take a visible moment, and
 * naming the step is what keeps that from looking like a stall.
 */
export const LocalWalletStatus = () => {
  const { t } = useTranslation()
  const phase = useUnit($localWalletPhase)

  if (phase === 'idle') {
    return null
  }

  return (
    <Root role="status" aria-live="polite">
      <Spinner size={16} width="2px" color="var(--ds-accent-11)" />
      <Text size="2" $themeVariant="primary">
        {t(`localWallet.status.${phase}`)}
      </Text>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-accent-3);
`
