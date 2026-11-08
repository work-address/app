import { useUnit } from 'effector-react'
import { useContext } from 'react'
import styled from 'styled-components'

import { getEntryChanges } from '../../model'
import { TimeContext } from '../time-context'

import type { Time } from '@/entities/time'

import { $user } from '@/entities/profile'
import { setTimePaidStatusMutation } from '@/entities/time'
import { Tooltip, WorkspaceStatus } from '@/shared'

type Props = {
  entry: Time
}

/**
 * An entry's payment status, which its author toggles on press. For anyone
 * else it is only a status, and a press opens the row behind it.
 *
 * A button rather than a clickable badge, so the toggle is reachable from the
 * keyboard; it stops the press so the row behind it does not open too.
 */
export const TimePaidBadge = ({ entry }: Props) => {
  const { t } = useContext(TimeContext)

  const { reader, setPaidStatus, status } = useUnit({
    reader: $user,
    setPaidStatus: setTimePaidStatusMutation.start,
    status: setTimePaidStatusMutation.$status,
  })

  const label = t(
    entry.isPaid
      ? 'dashboard.worklogsTable.paymentStatus.paid'
      : 'dashboard.worklogsTable.paymentStatus.unpaid',
  )

  const pill = (
    <WorkspaceStatus tone={entry.isPaid ? 'positive' : 'attention'}>
      {label}
    </WorkspaceStatus>
  )

  if (!getEntryChanges(entry, reader?.id).canMarkPaid) {
    return (
      <Tooltip content={t('common.metricDesc.paymentStatus')}>{pill}</Tooltip>
    )
  }

  return (
    <Tooltip content={t('common.metricDesc.paymentStatus')}>
      <Root
        type="button"
        // Unpaid is the ordinary state of fresh time, so it reads as
        // "waiting" rather than as a fault.
        aria-busy={status === 'pending' || undefined}
        onClick={(event) => {
          event.stopPropagation()

          if (!entry.id || status === 'pending') {
            return
          }

          setPaidStatus({ ids: [entry.id], isPaid: !entry.isPaid })
        }}
      >
        {pill}
      </Root>
    </Tooltip>
  )
}

/* The pill is the button: no chrome of its own beyond the status. */
const Root = styled.button`
  display: inline-grid;
  /* Above a stretched row trigger, where one sits behind it. */
  position: relative;
  z-index: var(--ui-layer-foreground);
  border-radius: var(--ui-pill-radius);
  cursor: pointer;
  transition: filter var(--ui-transition);

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
