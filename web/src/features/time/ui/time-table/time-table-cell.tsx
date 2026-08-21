import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from './time-context'

import type { Time } from '@/entities/time'

import { setTimePaidStatusMutation } from '@/entities/time'
import {
  type DesktopBodyCellRenderProps,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
  toImageDataUrl,
} from '@/shared'

export const TimeTableCell = memo((props: DesktopBodyCellRenderProps<Time>) => {
  const { dateFormatter, timeFormatter, t } = useContext(TimeContext)

  const { setPaidStatus, setPaidStatusStatus } = useUnit({
    setPaidStatus: setTimePaidStatusMutation.start,
    setPaidStatusStatus: setTimePaidStatusMutation.$status,
  })

  switch (props.dataKey) {
    case 'note': {
      return (
        <Text color={'gray'} size="2">
          {props.data.note}
        </Text>
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
          <PaidStatusBadge
            color={props.data.isPaid ? 'green' : 'red'}
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

const PaidStatusBadge = styled(Badge)`
  cursor: pointer;
`
