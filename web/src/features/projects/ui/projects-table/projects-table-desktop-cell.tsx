import { Badge, Flex } from '@radix-ui/themes'
import React, { type ReactNode, useContext } from 'react'
import styled from 'styled-components'

import { getProjectStatusTranslationKey } from '../../model'

import { ProjectsTableContext } from './projects-table-context'

import type { ProjectWithStats } from '@/entities/projects'

import { OpenInvoiceLink } from '@/features/invoice'
import {
  type DesktopBodyCellRenderProps,
  PrintIcon,
  Text,
  formatDurationFromMinutes,
} from '@/shared'

export const ProjectsDesktopCell = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectWithStats>) => {
    const { t } = useContext(ProjectsTableContext)
    let content: ReactNode | null

    switch (props.dataKey) {
      case 'title': {
        content = (
          <TitleCell align="center" gap="2">
            <Text $themeVariant={'primary'}>{props.data.title}</Text>
            <InvoiceLink
              projectId={props.data.id ?? ''}
              onClick={(event) => event.stopPropagation()}
            >
              <Text color={'gray'} size={'2'} as="span">
                |
              </Text>
              <Text size={'2'} as="span">
                {t('dashboard.projectsTable.actions.invoice')}
              </Text>
              <img src={PrintIcon} alt="" width={28} height={28} />
            </InvoiceLink>
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

const InvoiceLink = styled(OpenInvoiceLink)`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-2);
  text-decoration: none;
  color: inherit;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;

  tr:hover & {
    opacity: 1;
    pointer-events: auto;
  }
`
