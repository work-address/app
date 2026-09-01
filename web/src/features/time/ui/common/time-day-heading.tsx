import { useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from '../time-context'

import type { TimeDayGroup } from '../../model'

import { formatDurationFromMinutes } from '@/shared'

type Props = {
  group: TimeDayGroup
  className?: string
}

/**
 * One day's date and totals.
 *
 * Shared by both presentations rather than written twice, so the list and the
 * grid cannot drift into describing the same day differently.
 */
export const TimeDayHeading = ({ group, className }: Props) => {
  const { dayFormatter, t } = useContext(TimeContext)

  return (
    <Root className={className}>
      <Title>{dayFormatter.format(group.date)}</Title>
      <Caption>
        {t('dashboard.worklogsGrid.dayTotals', {
          tracked: formatDurationFromMinutes(group.trackedMinutes, t),
          percent: group.activityPercent,
        })}
      </Caption>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--space-3);
`

const Title = styled.h3`
  font-size: var(--font-size-3);
  font-weight: 500;
  color: var(--ds-neutral-12);
`

const Caption = styled.span`
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
`
