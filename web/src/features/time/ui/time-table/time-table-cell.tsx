import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from '../time-context'

import type { Time } from '@/entities/time'

import { setTimePaidStatusMutation } from '@/entities/time'
import {
  type DesktopBodyCellRenderProps,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
  toImageDataUrl,
  Tooltip,
} from '@/shared'

export const TimeTableCell = memo((props: DesktopBodyCellRenderProps<Time>) => {
  const { dateFormatter, timeFormatter, numberFormatter, t } =
    useContext(TimeContext)

  const { setPaidStatus, setPaidStatusStatus } = useUnit({
    setPaidStatus: setTimePaidStatusMutation.start,
    setPaidStatusStatus: setTimePaidStatusMutation.$status,
  })

  switch (props.dataKey) {
    case 'note': {
      const note = props.data.note

      if (!note) {
        return null
      }

      return (
        <Tooltip content={note}>
          {/* Radix needs a ref-able element to anchor the tooltip, and the
              ellipsis has to sit on whatever directly holds the text - an
              inner atomic inline would be clipped without the dots. */}
          <NoteAnchor>
            <NoteText color={'gray'} size="2">
              {note}
            </NoteText>
          </NoteAnchor>
        </Tooltip>
      )
    }

    case 'screenshot': {
      const screenshotSrc = toImageDataUrl(props.data.screenshot)

      return screenshotSrc ? (
        <Screenshot src={screenshotSrc} alt={props.data.project?.title || ''} />
      ) : (
        <Text size="2" color="gray">
          {t('dashboard.worklogsTable.screenshotNoData')}
        </Text>
      )
    }

    case 'fromAt': {
      return (
        <Flex direction={'column'}>
          <Text size="2">
            {timeFormatter.format(new Date(props.data.fromAt))}-
            {timeFormatter.format(new Date(props.data.toAt))}
          </Text>
          <Text size="2" color={'gray'}>
            {dateFormatter.format(new Date(props.data.fromAt))}
          </Text>
        </Flex>
      )
    }

    case 'mouseDistance': {
      return (
        <Text size="2">{numberFormatter.format(props.data.mouseDistance)}</Text>
      )
    }

    case 'minutesActive': {
      return (
        <Badge color={getTimeActiveColor(props.data.minutesActive)}>
          {formatDurationFromMinutes(props.data.minutesActive, t)}
        </Badge>
      )
    }

    default: {
      if (props.customKey === 'paidStatus') {
        const timeId = props.data.id

        return (
          <Tooltip content={t('common.metricDesc.paymentStatus')}>
            <PaidStatusBadge
              // Gray rather than red: unpaid is the ordinary state of freshly
              // tracked time, not a fault to flag.
              color={props.data.isPaid ? 'green' : 'gray'}
              onClick={(event) => {
                // Не даём клику по бейджу открыть модалку строки
                event.stopPropagation()

                if (!timeId || setPaidStatusStatus === 'pending') {
                  return
                }

                setPaidStatus({ ids: [timeId], isPaid: !props.data.isPaid })
              }}
            >
              {t(
                props.data.isPaid
                  ? 'dashboard.worklogsTable.paymentStatus.paid'
                  : 'dashboard.worklogsTable.paymentStatus.unpaid',
              )}
            </PaidStatusBadge>
          </Tooltip>
        )
      }

      return (
        <Text size="2">
          <props.DefaultBodyComponent {...props} />
        </Text>
      )
    }
  }
})

const Screenshot = styled.img`
  max-width: 64px;
`

const NoteAnchor = styled.span`
  display: block;
  /* Flex items refuse to shrink past their content without this, which would
     hand the note back the width the truncated column just took away. */
  min-width: 0;
  max-width: 100%;
`

const NoteText = styled(Text)`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const PaidStatusBadge = styled(Badge)`
  cursor: pointer;
`
