import { Pencil1Icon } from '@radix-ui/react-icons'
import { Badge, Flex, IconButton } from '@radix-ui/themes'
import { memo, useContext } from 'react'
import styled from 'styled-components'

import { WorklogsContext } from './worklogs-context'

import type { Time } from '@/entities/activities'

import {
  type DesktopBodyCellRenderProps,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
} from '@/shared'

const BodyCellComponent = memo((props: DesktopBodyCellRenderProps<Time>) => {
  const { dateFormatter, timeFormatter, t } = useContext(WorklogsContext)

  switch (props.dataKey) {
    case 'note': {
      return (
        <Text color={'gray'} size="2">
          {props.data.note}
        </Text>
      )
    }

    case 'screenshot': {
      return props.data.screenshot ? (
        <Screenshot
          src={props.data.screenshot}
          alt={props.data.activity?.title || ''}
        />
      ) : (
        <Screenshot
          src={'/img/photo/example-screenshot.png'}
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
      if (props.customKey === 'actions') {
        return (
          <Flex>
            <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
              <Pencil1Icon />
            </IconButton>
          </Flex>
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

export { BodyCellComponent }

const Screenshot = styled.img`
  max-width: 64px;
`
