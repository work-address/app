import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  IDENTITY_VIEW_MESSAGE_KEY,
  isIdentityChipState,
} from '../../model/identity-state'

import type { IdentityViewState } from '../../model/identity-state'

import { Text } from '@/shared'

type Props = {
  className?: string
  state: IdentityViewState
  /** The registry version the hosted presentation is anchored as. */
  version: number | null
}

/**
 * The one line a reader of someone else's profile gets about the chain: that
 * the profile is anchored, at which version, and what the registry said when
 * this page was built. A state a reader cannot act on - no account, nothing
 * anchored, anchoring off here - shows nothing at all rather than a chip
 * saying "no".
 */
export const IdentityChip = ({ className, state, version }: Props) => {
  const { t } = useTranslation()

  if (!isIdentityChipState(state)) {
    return null
  }

  const explanation = t(IDENTITY_VIEW_MESSAGE_KEY[state])

  return (
    // `title` rather than a tooltip component: the chip is one line on a
    // public page that a reader may open with no Radix Theme above it - a
    // shared portal-and-provider tooltip is a lot of machinery for a
    // sentence the browser will show on its own.
    <Root
      className={className}
      data-state={state}
      title={explanation}
      aria-label={explanation}
    >
      <Text size="1" weight="medium">
        {t('identity.chip.title')}
      </Text>
      {version !== null && (
        <Text size="1" color="gray">
          v{version}
        </Text>
      )}
    </Root>
  )
}

const Root = styled.span`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-3);
  background: var(--ds-neutral-3);

  &[data-state='current'] {
    background: var(--ds-accent-3);
  }

  &[data-state='superseded'],
  &[data-state='mismatch'],
  &[data-state='withdrawn'] {
    background: var(--ds-amber-3);
  }
`
