import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import type { ProjectDialogMode } from './types'

import { routes } from '@/routes'
import { IconButton, PrintIcon, Text, useBreakpoint } from '@/shared'

type ProjectDialogTitleProps = {
  title?: string
  projectId?: string
  mode: ProjectDialogMode
  onDelete: () => void
}

export const ProjectDialogTitle = ({
  title,
  projectId,
  mode,
  onDelete,
}: ProjectDialogTitleProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')

  const invoiceLink = projectId ? (
    <InvoiceLink
      to={routes.invoice.build({ id: projectId })}
      viewTransition
      aria-label={t('dashboard.projectsTable.actions.invoice')}
      onClick={(event) => event.stopPropagation()}
    >
      <Text size="2" as="span">
        {t('dashboard.projectsTable.drawer.invoice')}
      </Text>
      <img src={PrintIcon} alt="" width={28} height={28} />
    </InvoiceLink>
  ) : null

  const heading =
    mode === 'view'
      ? title
      : t('dashboard.projectsTable.drawer.editProjectTitle')

  if (isDesktop) {
    return (
      <Flex justify="between" align="center" gap="3" width="100%">
        <Text as="span" size="6" weight="medium" style={{ minWidth: 0 }}>
          {heading}
        </Text>
        {mode === 'view' && invoiceLink}
      </Flex>
    )
  }

  return (
    <Flex justify="between" align="center" gap="2" width="100%">
      <Text as="span" style={{ minWidth: 0 }}>
        {title}
      </Text>
      <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
        {mode === 'view' && invoiceLink}
        <IconButton
          color="red"
          variant="outline"
          onClick={onDelete}
          type="button"
        >
          <TrashIcon />
        </IconButton>
      </Flex>
    </Flex>
  )
}

const InvoiceLink = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-2);
  text-decoration: none;
  color: inherit;
`
