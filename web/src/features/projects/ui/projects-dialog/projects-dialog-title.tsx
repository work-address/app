import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import type { ProjectsDialogMode } from '../../model'

import { OpenInvoiceLink } from '@/features/invoice'
import { IconButton, PrintIcon, Text, Tooltip, useBreakpoint } from '@/shared'

type ProjectsDialogTitleProps = {
  title?: string
  projectId?: string
  mode: ProjectsDialogMode
  onDelete: () => void
}

export const ProjectsDialogTitle = ({
  title,
  projectId,
  mode,
  onDelete,
}: ProjectsDialogTitleProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')

  // TODO: move invoice link next to hte other buttons
  const invoiceLink = projectId ? (
    <OpenInvoiceLink projectId={projectId} variant={'button'}>
      <Text size="2" as="span">
        {t('dashboard.projectsTable.drawer.invoice')}
      </Text>
      <img src={PrintIcon} alt="" width={28} height={28} />
    </OpenInvoiceLink>
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
        <Tooltip content={t('dashboard.projectsTable.deleteHint')}>
          <IconButton
            color="red"
            variant="outline"
            onClick={onDelete}
            type="button"
            aria-label={t('dashboard.projectsTable.actions.delete')}
          >
            <TrashIcon />
          </IconButton>
        </Tooltip>
      </Flex>
    </Flex>
  )
}
