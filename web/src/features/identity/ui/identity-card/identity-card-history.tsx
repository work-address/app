import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { IdentityView } from '../../model/identity-state'

import { Text } from '@/shared'

type Props = {
  className?: string
  /** Null when the registry could not be read; empty when it holds nothing. */
  history: IdentityView['history']
}

/**
 * The registry's own version history, read from its events on every read and
 * stored nowhere here. A chain that could not be read shows as such, never as
 * an empty history: "no versions" and "we could not ask" are different facts.
 */
export const IdentityCardHistory = ({ className, history }: Props) => {
  const { t, i18n } = useTranslation()
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <Root className={className}>
      <Text size="3" weight="medium">
        {t('identity.history.title')}
      </Text>
      {history === null && (
        <Text size="2" color="gray">
          {t('identity.history.unavailable')}
        </Text>
      )}
      {history?.length === 0 && (
        <Text size="2" color="gray">
          {t('identity.history.empty')}
        </Text>
      )}
      {history !== null && history.length > 0 && (
        <List>
          {history.map((event) => (
            <Item
              key={`${event.transactionHash}:${event.logIndex}`}
              data-kind={event.kind === 'PUBLISHED' ? 'published' : 'withdrawn'}
            >
              <Text size="2" weight="medium">
                {t(
                  event.kind === 'PUBLISHED'
                    ? 'identity.history.published'
                    : 'identity.history.withdrawn',
                )}{' '}
                v{event.version}
              </Text>
              <Text size="1" color="gray">
                {formatter.format(new Date(event.at))}
              </Text>
            </Item>
          ))}
        </List>
      )}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-2);
`

const List = styled.ol`
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  display: grid;
  gap: 0 var(--space-3);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  overflow-wrap: anywhere;

  ${(p) => p.theme.breakpoints.up('md')} {
    grid-auto-flow: column;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  &[data-kind='withdrawn'] {
    background: var(--ds-amber-2);
  }
`
