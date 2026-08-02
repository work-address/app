import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from './time-context'

import type { Time } from '@/entities/time'

import { setWorklogPaidStatusMutation } from '@/entities/time'
import {
  type DesktopBodyCellRenderProps,
  ExampleScreenshot,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
  toImageDataUrl,
} from '@/shared'

const TimeTableCell = memo((props: DesktopBodyCellRenderProps<Time>) => {
  const { dateFormatter, timeFormatter, t } = useContext(TimeContext)

  const { setPaidStatus, setPaidStatusStatus } = useUnit({
    setPaidStatus: setWorklogPaidStatusMutation.start,
    setPaidStatusStatus: setWorklogPaidStatusMutation.$status,
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
        <Screenshot
          src={ExampleScreenshot}
          alt={t('dashboard.worklogsTable.screenshotNoData')}
        />
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
        const worklogId = props.data.id

        return (
          <PaidStatusBadge
            color={props.data.isPaid ? 'green' : 'red'}
            onClick={(event) => {
              // Не даём клику по бейджу открыть модалку строки
              event.stopPropagation()

              if (!worklogId || setPaidStatusStatus === 'pending') {
                return
              }

              setPaidStatus({ ids: [worklogId], isPaid: !props.data.isPaid })
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

export { TimeTableCell }

const Screenshot = styled.img`
  max-width: 64px;
`

const PaidStatusBadge = styled(Badge)`
  cursor: pointer;
`
