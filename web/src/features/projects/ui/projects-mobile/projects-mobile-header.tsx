import { Badge, Flex } from '@radix-ui/themes'
import React, { useContext } from 'react'
import { NavLink } from 'react-router-dom'

import { getProjectStatusTranslationKey } from '../../model'
import { ProjectsTableContext } from '../projects-table/projects-table-context'

import type { ProjectWithStats } from '@/entities/projects'

import { routes } from '@/routes'
import { type MobileHeaderRenderProps, PrintIcon, Text } from '@/shared'

export const ProjectsMobileHeader = React.memo(
  (props: MobileHeaderRenderProps<ProjectWithStats>) => {
    const { t } = useContext(ProjectsTableContext)
    const statusKey = getProjectStatusTranslationKey(props.data.state)

    return (
      <Flex direction={'column'}>
        <Flex align={'center'} gap={'2'}>
          <Text size={'4'} $themeVariant={'primary'} weight={'medium'}>
            {props.data.title}
          </Text>
          <NavLink
            to={routes.invoice.build({ id: props.data.id ?? '' })}
            onClick={(e) => e.stopPropagation()}
            viewTransition
            aria-label={t('dashboard.projectsTable.actions.invoice')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              textDecoration: 'none',
              color: 'inherit',
              flexShrink: 0,
            }}
          >
            <Text color={'gray'} size={'2'} as="span">
              |
            </Text>
            <Text size={'2'} as="span">
              {t('dashboard.projectsTable.actions.invoice')}
            </Text>
            <img src={PrintIcon} alt="" width={24} height={24} />
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
