import { Badge, Flex, HoverCard } from '@radix-ui/themes'
import React, { type ReactNode, useContext } from 'react'
import styled from 'styled-components'

import { getProjectStatusTranslationKey } from '../../model'

import { ProjectsTableContext } from './projects-table-context'

import type { ProjectWithStats } from '@/entities/projects'

import {
  type DesktopBodyCellRenderProps,
  Text,
  formatDurationFromMinutes,
} from '@/shared'

export const ProjectsDesktopCell = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectWithStats>) => {
    const { t, projectPopup } = useContext(ProjectsTableContext)
    let content: ReactNode | null

    switch (props.dataKey) {
      case 'title': {
        content = (
          <TitleCell align="center" gap="2">
            {projectPopup ? (
              // The name opens the project's details on hover or focus;
              // the row itself still opens the project dialog on click.
              <HoverCard.Root openDelay={250} closeDelay={80}>
                <HoverCard.Trigger>
                  <Name tabIndex={0}>
                    <Text $themeVariant={'primary'}>{props.data.title}</Text>
                  </Name>
                </HoverCard.Trigger>
                <HoverCard.Content
                  size="1"
                  // Beside the name, so the card slides up or down to fit
                  // the screen instead of running off its bottom.
                  side="right"
                  align="center"
                  collisionPadding={12}
                  // A set width: its columns would collapse into one
                  // under a width that only shrinks to fit.
                  width="min(880px, calc(100vw - 32px))"
                  maxWidth="min(880px, calc(100vw - 32px))"
                >
                  {projectPopup(props.data)}
                </HoverCard.Content>
              </HoverCard.Root>
            ) : (
              <Text $themeVariant={'primary'}>{props.data.title}</Text>
            )}
          </TitleCell>
        )
        break
      }

      case 'state': {
        const statusKey = getProjectStatusTranslationKey(props.data.state)
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
              {formatDurationFromMinutes(props.data.minutesActive, t)}
            </Text>
          )
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

const TitleCell = styled(Flex)`
  min-width: 0;
`

const Name = styled.span`
  border-radius: var(--radius-1);

  &:focus-visible {
    outline: 2px solid var(--ds-accent-8);
    outline-offset: 2px;
  }
`
