import { Pencil1Icon } from '@radix-ui/react-icons'
import { Badge, Flex, IconButton } from '@radix-ui/themes'
import { memo } from 'react'
import styled from 'styled-components'

import type { WorklogRow } from './types'

import { type DesktopBodyCellRenderProps, Text } from '@/features/shared'

const BodyCellComponent = memo(
  (props: DesktopBodyCellRenderProps<WorklogRow>) => {
    switch (props.dataKey) {
      case 'date': {
        return (
          <Flex direction={'column'}>
            <Text>{props.data.dateRange}</Text>
            <Text color={'gray'}>{props.data.date}</Text>
          </Flex>
        )
      }

      case 'note': {
        return <Text color={'gray'}>{props.data.note}</Text>
      }

      case 'timeActive': {
        return (
          <Badge color={Number(props.data.key) % 3 === 0 ? 'red' : 'green'}>
            {props.data.timeActive}
          </Badge>
        )
      }

      case 'paymentStatus': {
        return (
          <Badge color={props.data.paymentStatus === 'Paid' ? 'green' : 'red'}>
            {props.data.paymentStatus}
          </Badge>
        )
      }

      case 'screenshot': {
        return props.data.screenshot ? (
          <Screenshot
            src={props.data.screenshot}
            alt={props.data.projectName}
          />
        ) : (
          <Screenshot
            src={'/img/photo/example-screenshot.png'}
            alt={'No data'}
          />
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

        return <props.DefaultBodyComponent {...props} />
      }
    }
  },
)

export { BodyCellComponent }

const Screenshot = styled.img`
  max-width: 64px;
`
