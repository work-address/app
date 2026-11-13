import { ExclamationTriangleIcon, MobileIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time } from '@/entities/time'

import { mayBeFaked, Tooltip } from '@/shared'

const ICON_SIZE = 12

/** Whether an entry was tracked from a phone, which records no input. */
export const isPhoneTime = (entry: Pick<Time, 'source'>) =>
  entry.source === 'mobile'

/**
 * Marks phone time, so its missing keyboard and mouse figures read as never
 * recorded rather than as a still worker, and says when the phone reported a
 * faked position. Nothing for any other entry.
 */
export const TimeSourceMark = ({
  entry,
}: {
  entry: Pick<Time, 'source' | 'locations'>
}) => {
  const { t } = useTranslation()

  if (!isPhoneTime(entry)) {
    return null
  }

  return (
    <Marks>
      <Tooltip content={t('time.source.mobileHint')}>
        <Root>
          <MobileIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
          {t('time.source.mobile')}
        </Root>
      </Tooltip>
      <TimeFakedMark entry={entry} compact />
    </Marks>
  )
}

/** "Location may be faked", where a fix of the entry's says so. */
export const TimeFakedMark = ({
  entry,
  compact = false,
}: {
  entry: Pick<Time, 'locations'>
  /** The icon alone, beside other marks; the words go in its tooltip. */
  compact?: boolean
}) => {
  const { t } = useTranslation()

  if (!mayBeFaked(entry.locations)) {
    return null
  }

  return (
    <Tooltip content={t('time.location.fakedHint')}>
      <Faked aria-label={compact ? t('time.location.faked') : undefined}>
        <ExclamationTriangleIcon
          width={ICON_SIZE}
          height={ICON_SIZE}
          aria-hidden
        />
        {!compact && t('time.location.faked')}
      </Faked>
    </Tooltip>
  )
}

const Marks = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
`

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  white-space: nowrap;
`

const Faked = styled(Root)`
  color: var(--red-11);
`
