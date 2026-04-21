import { Pencil1Icon } from '@radix-ui/react-icons'
import { Badge, Flex, IconButton } from '@radix-ui/themes'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { WorklogRow } from './types'

import {
  type DesktopBodyCellRenderProps,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
} from '@/features/shared'

const BodyCellComponent = memo(
  (props: DesktopBodyCellRenderProps<WorklogRow>) => {
    const { t } = useTranslation()
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
          <Badge color={getTimeActiveColor(props.data.timeActive)}>
            {formatDurationFromMinutes(props.data.timeActive, t)}
          </Badge>
        )
      }

      case 'paymentStatus': {
        const paid = props.data.paymentStatus === 'Paid'
        return (
          <Badge color={paid ? 'green' : 'red'}>
            {paid
              ? t('dashboard.worklogsTable.paymentStatus.paid')
              : t('dashboard.worklogsTable.paymentStatus.unpaid')}
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
            alt={t('dashboard.worklogsTable.screenshotNoData')}
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
