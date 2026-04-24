import { TrashIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import React, { type ReactNode, useContext } from 'react'
import { NavLink } from 'react-router-dom'

import { ProjectsTableContext } from './context.ts'

import type { ProjectWithStats } from '@/entities/activities'

import { routes } from '@/routes'
import {
  type DesktopBodyCellRenderProps,
  IconButton,
  Text,
  formatDurationFromMinutes,
} from '@/features/shared'
import { routes } from '@/routes'

const statusTranslationKey = (status: string) => {
  const key = status.toLowerCase()
  if (key === 'active' || key === 'paused' || key === 'finished') {
    return `dashboard.projectsTable.status.${key}` as const
  }
  return null
}

export const DesktopCell = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectWithStats>) => {
    const { t } = useContext(ProjectsTableContext)
    let content: ReactNode | null

    switch (props.dataKey) {
      case 'title': {
        content = (
          <Text $themeVariant={'primary'}>
            <NavLink to={routes.invoice.build({ id: props.data.id ?? '' })}>
              {props.data.title}
            </NavLink>
          </Text>
        )
        break
      }

      case 'state': {
        const statusKey = statusTranslationKey(props.data.state)
        content = (
          <Badge color={props.data.state === 'Active' ? 'green' : 'gray'}>
            {statusKey === null ? props.data.state : t(statusKey)}
          </Badge>
        )
        break
      }

      default: {
        if (props.customKey === 'timeTotal') {
          content = (
            <Text color={'gray'}>
              {formatDurationFromMinutes(props.data.minutes, t)}
            </Text>
          )
        } else if (props.customKey === 'timeActive') {
          content = (
            <Text color={'gray'}>
              {formatDurationFromMinutes(props.data.minutesActiveTotal, t)}
            </Text>
          )
        } else if (props.customKey === 'actions') {
          content = <Actions {...props} />
        } else {
          content = (
            <Text color={'gray'}>
              <props.DefaultBodyComponent {...props} />
            </Text>
          )
        }

        break
      }
    }

    return (
      <Flex py={'4.5px'} direction={'column'}>
        {content}
      </Flex>
    )
  },
)

const Actions = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectWithStats>) => {
    const { handleActionClick, t } = useContext(ProjectsTableContext)

    return (
      <Flex gap={'3'} align={'center'}>
        <IconButton
          variant={'ghost'}
          color={'gray'}
          radius={'full'}
          onClick={() => handleActionClick(props.data, 'Print')}
        >
          <img
            src={'/img/icons/print.svg'}
            alt={t('dashboard.projectsTable.actions.print')}
            style={{ width: 28, height: 28, margin: -4, padding: 0 }}
          />
        </IconButton>

        <IconButton
          variant={'ghost'}
          color={'gray'}
          radius={'full'}
          onClick={() => handleActionClick(props.data, 'Delete')}
        >
          <TrashIcon height={20} width={20} />
        </IconButton>

        <IconButton
          variant={'ghost'}
          color={'gray'}
          radius={'full'}
          onClick={() => handleActionClick(props.data, 'Edit')}
        >
          <Pencil1Icon height={20} width={20} />
        </IconButton>
      </Flex>
    )
  },
)
