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
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('sm')} {
    grid-auto-flow: row;
    gap: 0;
  }
`

const Title = styled.h3`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

const Caption = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`
