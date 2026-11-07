import { Badge, Flex } from '@radix-ui/themes'
import React, { useContext } from 'react'
import styled from 'styled-components'

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

/**
 * The card heading on a phone: the name with its status on one line, the
 * money and the invoice link on the next.
 *
 * The invoice link used to sit inline after the title, which wrapped a long
 * name around it - "Elegant Gold / Shirt | Invoice" - so the two rows are
 * laid out separately and the title alone is allowed to wrap.
 */
export const ProjectsMobileHeader = React.memo(
  (props: MobileHeaderRenderProps<ProjectWithStats>) => {
    const { t } = useContext(ProjectsTableContext)
    const statusKey = getProjectStatusTranslationKey(props.data.state)

    return (
      <Flex direction={'column'} gap={'1'} minWidth={'0'}>
        <TitleRow>
          <Title size={'4'} $themeVariant={'primary'} weight={'medium'}>
            {props.data.title}
          </Title>
          <Badge color={props.data.state === 'Active' ? 'green' : 'gray'}>
            {statusKey === null ? props.data.state : t(statusKey)}
          </Badge>
        </TitleRow>
        <Flex align={'center'} gap={'3'}>
          {props.data.paidCents !== undefined && (
            <Text color={'gray'} size={'2'}>
              {formatCurrency(props.data.paidCents / 100)}
            </Text>
          )}
          <InvoiceLink
            projectId={props.data.id ?? ''}
            onClick={(event) => event.stopPropagation()}
          >
            <Text size={'2'} as="span">
              {t('dashboard.projectsTable.actions.invoice')}
            </Text>
            <img src={PrintIcon} alt="" width={20} height={20} />
          </InvoiceLink>
        </Flex>
      </Flex>
    )
  },
)

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
  min-width: 0;
`

const Title = styled(Text)`
  min-width: 0;
  overflow-wrap: anywhere;
`

const InvoiceLink = styled(OpenInvoiceLink)`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  flex-shrink: 0;
  color: var(--ui-muted);
  text-decoration: none;
`
