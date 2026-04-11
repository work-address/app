import { Badge, Flex } from '@radix-ui/themes'
import React from 'react'
import { NavLink } from 'react-router-dom'

import type { ProjectRow } from './types.ts'

import { type MobileHeaderRenderProps, routes, Text } from '@/features/shared'

export const MobileHeader = React.memo(
  (props: MobileHeaderRenderProps<ProjectRow>) => {
    return (
      <Flex direction={'column'}>
        <Flex align={'center'} gap={'2'}>
          <NavLink to={routes.invoice.build({ id: props.data.key })}>
            <Text size={'4'} $themeVariant={'primary'} weight={'medium'}>
              {props.data.name}
            </Text>
          </NavLink>

          <Badge color={props.data.status === 'Active' ? 'green' : 'gray'}>
            {props.data.status}
          </Badge>
        </Flex>

        <Text color={'gray'} size={'2'}>
          {props.data.earnings}
        </Text>
      </Flex>
    )
  },
)
