import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import type { ProjectsDialogMode } from '../../model'

import { IconButton, Text, Tooltip, useBreakpoint } from '@/shared'

type ProjectsDialogTitleProps = {
  title?: string
  mode: ProjectsDialogMode
  onDelete: () => void
}

export const ProjectsDialogTitle = ({
  title,
  mode,
  onDelete,
}: ProjectsDialogTitleProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')

  const heading =
    mode === 'view'
      ? title
      : t('dashboard.projectsTable.drawer.editProjectTitle')

  if (isDesktop) {
    return (
      <Text as="span" size="6" weight="medium" style={{ minWidth: 0 }}>
        {heading}
      </Text>
    )
  }

  return (
    <Flex justify="between" align="center" gap="2" width="100%">
      <Text as="span" style={{ minWidth: 0 }}>
        {heading}
      </Text>
      <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
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
