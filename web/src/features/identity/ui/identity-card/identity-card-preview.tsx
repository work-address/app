import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { IDENTITY_FIELD_LABEL_KEY } from '../../model/identity-copy'

import type {
  IdentityPreview,
  IdentitySlotPreview,
} from '../../model/identity-slots'
import type { FieldValue } from '@/shared/vendor/identity'

import { Text } from '@/shared'

type Props = {
  className?: string
  preview: IdentityPreview
}

/** The value as the leaf commits it, not as the profile page styles it. */
const asText = (value: FieldValue): string => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  if (typeof value === 'string') {
    return value
  }

  return `${(value.rateHourCents / 100).toFixed(2)} ${value.currency}`
}

/**
 * Every schema v1 slot and what it will hold, read before publishing. An
 * empty slot is shown as a blank slot rather than hidden: a holder should see
 * that the tree has a place for the field and that the place will be filled
 * with nothing anyone can open.
 */
export const IdentityCardPreview = ({ className, preview }: Props) => {
  const { t } = useTranslation()

  return (
    <Root className={className}>
      <Text size="3" weight="medium">
        {t('identity.preview.title')}
      </Text>
      <List>
        {preview.slots.map((slot) => (
          <Item key={slot.slot} data-state={slot.state}>
            <Label size="2" color="gray">
              {t(IDENTITY_FIELD_LABEL_KEY[slot.key])}
            </Label>
            <Value size="2">{valueOf(slot, t)}</Value>
          </Item>
        ))}
      </List>
      {preview.committedCount === 0 && (
        <Text size="2" color="amber">
          {t('identity.preview.nothing')}
        </Text>
      )}
    </Root>
  )
}

const valueOf = (
  slot: IdentitySlotPreview,
  t: (key: string) => string,
): string => {
  if (slot.state === 'committed' && slot.value !== null) {
    return asText(slot.value)
  }

  return slot.state === 'unusable'
    ? `${t('identity.preview.unusable')} — ${slot.reason ?? ''}`.trim()
    : t('identity.preview.empty')
}

const Root = styled.div`
  display: grid;
  gap: var(--space-2);
`

const List = styled.dl`
  display: grid;
  gap: var(--space-1);
  margin: 0;
`

const Item = styled.div`
  display: grid;
  /* One column on a phone, label over value: a 14-row two-column grid with a
     fixed label column is what pushes this card past 375px. */
  grid-template-columns: minmax(0, 1fr);
  gap: 0 var(--space-3);
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--ds-neutral-alpha-3);

  ${(p) => p.theme.breakpoints.up('md')} {
    grid-template-columns: minmax(0, 8rem) minmax(0, 1fr);
  }

  &[data-state='empty'],
  &[data-state='unusable'] {
    color: var(--ds-neutral-9);
  }
`

const Label = styled(Text)`
  overflow-wrap: anywhere;
`

const Value = styled(Text)`
  overflow-wrap: anywhere;

  ${Item}[data-state='empty'] & {
    font-style: italic;
  }

  ${Item}[data-state='unusable'] & {
    color: var(--ds-amber-11);
  }
`
