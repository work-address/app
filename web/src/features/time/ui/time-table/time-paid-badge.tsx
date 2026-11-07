import { useUnit } from 'effector-react'
import { useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from '../time-context'

import type { Time } from '@/entities/time'

import { setTimePaidStatusMutation } from '@/entities/time'
import { Tooltip } from '@/shared'

type Props = {
  entry: Time
}

/**
 * An entry's payment status, which toggles it on press.
 *
 * A button rather than a clickable badge, so the toggle is reachable from the
 * keyboard; it stops the press so the row behind it does not open too.
 */
export const TimePaidBadge = ({ entry }: Props) => {
  const { t } = useContext(TimeContext)

  const { setPaidStatus, status } = useUnit({
    setPaidStatus: setTimePaidStatusMutation.start,
    status: setTimePaidStatusMutation.$status,
  })

  const label = t(
    entry.isPaid
      ? 'dashboard.worklogsTable.paymentStatus.paid'
      : 'dashboard.worklogsTable.paymentStatus.unpaid',
  )

  return (
    <Tooltip content={t('common.metricDesc.paymentStatus')}>
      <Root
        type="button"
        // Gray rather than red: unpaid is the ordinary state of freshly
        // tracked time, not a fault to flag.
        data-paid={entry.isPaid || undefined}
        aria-busy={status === 'pending' || undefined}
        onClick={(event) => {
          event.stopPropagation()

          if (!entry.id || status === 'pending') {
            return
          }

          setPaidStatus({ ids: [entry.id], isPaid: !entry.isPaid })
        }}
      >
        {label}
      </Root>
    </Tooltip>
  )
}

const Root = styled.button`
  --paid-color: var(--ui-muted);
  --paid-background: var(--ui-inset);

  display: inline-grid;
  align-items: center;
  /* Above a stretched row trigger, where one sits behind it. */
  position: relative;
  z-index: var(--ui-layer-foreground);
  min-height: var(--ui-space-6);
  padding-inline: var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--paid-background);
  color: var(--paid-color);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: filter var(--ui-transition);

  &[data-paid] {
    --paid-color: var(--green-11);
    --paid-background: var(--green-a3);
  }

  &:hover {
    filter: brightness(0.96);
  }

  &[aria-busy='true'] {
    cursor: progress;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`
