import { MobileIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time } from '@/entities/time'

import { Tooltip } from '@/shared'

const ICON_SIZE = 12

/** Whether an entry was tracked from a phone, which records no input. */
export const isPhoneTime = (entry: Pick<Time, 'source'>) =>
  entry.source === 'mobile'

/**
 * Marks phone time, so its missing keyboard and mouse figures read as never
 * recorded rather than as a still worker. Nothing for any other entry.
 */
export const TimeSourceMark = ({ entry }: { entry: Pick<Time, 'source'> }) => {
  const { t } = useTranslation()

  if (!isPhoneTime(entry)) {
    return null
  }

  return (
    <Tooltip content={t('time.source.mobileHint')}>
      <Root>
        <MobileIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
        {t('time.source.mobile')}
      </Root>
    </Tooltip>
  )
}

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  white-space: nowrap;
`
