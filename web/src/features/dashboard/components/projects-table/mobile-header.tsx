import { Badge, Flex } from '@radix-ui/themes'
import React, { useContext } from 'react'
import { NavLink } from 'react-router-dom'

import { ProjectsTableContext } from './context.ts'

import type { ProjectWithStats } from '@/entities/activities'

import { routes } from '@/routes'
import { type MobileHeaderRenderProps, Text } from '@/shared'

const statusTranslationKey = (status: string) => {
  const key = status.toLowerCase()

  if (key === 'active' || key === 'paused' || key === 'finished') {
    return `dashboard.projectsTable.status.${key}` as const
  }

  return null
}

export const MobileHeader = React.memo(
  (props: MobileHeaderRenderProps<ProjectWithStats>) => {
    const { t } = useContext(ProjectsTableContext)
    const statusKey = statusTranslationKey(props.data.state)

    return (
      <Flex direction={'column'}>
        <Flex align={'center'} gap={'2'}>
          <NavLink
            to={routes.invoice.build({ id: props.data.id ?? '' })}
            onClick={(e) => e.stopPropagation()}
            viewTransition
          >
            <Text size={'4'} $themeVariant={'primary'} weight={'medium'}>
              {props.data.title}
            </Text>
          </NavLink>

          <Badge color={props.data.state === 'Active' ? 'green' : 'gray'}>
            {statusKey === null ? props.data.state : t(statusKey)}
          </Badge>
        </Flex>

        <Text color={'gray'} size={'2'}>
          {props.data.earnings} {t('currency.usdt')}
        </Text>
      </Flex>
    )
  },
)
