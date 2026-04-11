import { TrashIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import React, { type ReactNode, useContext } from 'react'
import { NavLink } from 'react-router-dom'

import type { ProjectRow } from './types.ts'

import { ProjectsTableContext } from '@/features/dashboard/components/projects-table/context.ts'
import {
  type DesktopBodyCellRenderProps,
  IconButton,
  routes,
  Text,
} from '@/features/shared'

export const DesktopCell = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectRow>) => {
    let content: ReactNode | null

    switch (props.dataKey) {
      case 'name': {
        content = (
          <Text $themeVariant={'primary'}>
            <NavLink to={routes.invoice.build({ id: props.data.key })}>
              {props.data.name}
            </NavLink>
          </Text>
        )
        break
      }

      case 'status': {
        content = (
          <Badge color={props.data.status === 'Active' ? 'green' : 'gray'}>
            {props.data.status}
          </Badge>
        )
        break
      }

      default: {
        if (props.customKey === 'actions') {
          return <Actions {...props} />
        }

        content = (
          <Text color={'gray'}>
            <props.DefaultBodyComponent {...props} />
          </Text>
        )
        break
      }
    }

    return (
      <Flex py={'3.5px'} direction={'column'}>
        {content}
      </Flex>
    )
  },
)

const Actions = React.memo((props: DesktopBodyCellRenderProps<ProjectRow>) => {
  const { handleActionClick } = useContext(ProjectsTableContext)

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
          alt={'Print'}
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
})
