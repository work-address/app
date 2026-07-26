import { Badge, Flex } from '@radix-ui/themes'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from './time-context'

import type { Time } from '@/entities/time'

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
