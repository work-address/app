import { Badge, Flex } from '@radix-ui/themes'
import React, { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import type { ProjectRow } from './types.ts'

import { type DesktopBodyCellRenderProps, Text } from '@/features/shared'

export const DesktopCell = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectRow>) => {
    let content: ReactNode | null

    switch (props.dataKey) {
      case 'name': {
        content = (
          <Text $themeVariant={'primary'}>
            <NavLink to={'/test'}>{props.data.name}</NavLink>
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
        content = (
          <Text color={'gray'}>
            <props.DefaultBodyComponent {...props} />
          </Text>
        )
        break
      }
    }

    return (
      <Flex py={'1'} direction={'column'}>
        {content}
      </Flex>
    )
  },
)
