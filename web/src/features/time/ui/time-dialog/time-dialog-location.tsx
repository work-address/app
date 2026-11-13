import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { isPhoneTime, TimeFakedMark } from '../common'

import type { Time } from '@/entities/time'

import { hasFix, Text, TrailMap } from '@/shared'

type Props = {
  time: Pick<
    Time,
    'source' | 'locations' | 'locationStatus' | 'detailPendingReview'
  >
}

/** What to say where there is no trail to draw. */
const NO_TRAIL_KEY_BY_STATUS: Record<string, string> = {
  removed: 'time.location.removed',
  expired: 'time.location.expired',
}

/**
 * Where the phone was during the entry: its map, or why there is none. Only
 * a phone entry has one, and nothing shows while its detail is under review.
 */
export const TimeDialogLocation = ({ time }: Props) => {
  const { t, i18n } = useTranslation()
  const formatTime = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, {
      hour: 'numeric',
      minute: '2-digit',
    })
    return (at: string) => formatter.format(new Date(at))
  }, [i18n.language])

  if (!isPhoneTime(time) || time.detailPendingReview) {
    return null
  }

  const points = time.locations ?? []

  return (
    <Root>
      <Heading>
        <Text size="2" weight="medium">
          {t('time.location.title')}
        </Text>
        <TimeFakedMark entry={time} />
      </Heading>
      {hasFix(points) ? (
        <TrailMap
          points={points}
          label={t('time.location.mapLabel')}
          fakedLabel={t('time.location.faked')}
          formatTime={formatTime}
        />
      ) : (
        <Text size="2" color="gray">
          {t(
            NO_TRAIL_KEY_BY_STATUS[time.locationStatus ?? ''] ??
              'time.location.none',
          )}
        </Text>
      )}
    </Root>
  )
}

const Root = styled.section`
  display: grid;
  gap: var(--ui-space-2);
  min-width: 0;
`

const Heading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
`
