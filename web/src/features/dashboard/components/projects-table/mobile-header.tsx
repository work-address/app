import { Badge, Flex } from '@radix-ui/themes'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import type { ProjectRow } from './types.ts'

import { type MobileHeaderRenderProps, routes, Text } from '@/features/shared'

const statusTranslationKey = (status: string) => {
  const key = status.toLowerCase()
  if (key === 'active' || key === 'paused' || key === 'finished') {
    return `dashboard.projectsTable.status.${key}` as const
  }
  return null
}

export const MobileHeader = React.memo(
  (props: MobileHeaderRenderProps<ProjectRow>) => {
    const { t } = useTranslation()
    const statusKey = statusTranslationKey(props.data.status)

    return (
      <Flex direction={'column'}>
        <Flex align={'center'} gap={'2'}>
          <NavLink
            to={routes.invoice.build({ id: props.data.key })}
            onClick={(e) => e.stopPropagation()}
          >
            <Text size={'4'} $themeVariant={'primary'} weight={'medium'}>
              {props.data.name}
            </Text>
          </NavLink>

          <Badge color={props.data.status === 'Active' ? 'green' : 'gray'}>
            {statusKey === null ? props.data.status : t(statusKey)}
          </Badge>
        </Flex>

        <Text color={'gray'} size={'2'}>
          {props.data.earnings}
        </Text>
      </Flex>
    )
  },
)
