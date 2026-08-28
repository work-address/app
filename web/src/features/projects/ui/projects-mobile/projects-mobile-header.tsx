import { Badge, Flex } from '@radix-ui/themes'
import React, { useContext } from 'react'

import { getProjectStatusTranslationKey } from '../../model'
import { ProjectsTableContext } from '../projects-table/projects-table-context'

import type { ProjectWithStats } from '@/entities/projects'

import { OpenInvoiceLink } from '@/features/invoice'
import {
  formatCurrency,
  type MobileHeaderRenderProps,
  PrintIcon,
  Text,
} from '@/shared'

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
          <OpenInvoiceLink
            projectId={props.data.id ?? ''}
            onClick={(event) => event.stopPropagation()}
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
          </OpenInvoiceLink>
          <Badge color={props.data.state === 'Active' ? 'green' : 'gray'}>
            {statusKey === null ? props.data.state : t(statusKey)}
          </Badge>
        </Flex>
        <Text color={'gray'} size={'2'}>
          {formatCurrency(props.data.paid)}
        </Text>
      </Flex>
    )
  },
)
