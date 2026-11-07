import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { ProjectsDialogMode } from '../../model'

import { IconButton, Text, Tooltip, useBreakpoint } from '@/shared'

type ProjectsDialogTitleProps = {
  title?: string
  mode: ProjectsDialogMode
  canDelete: boolean
  onDelete: () => void
}

export const ProjectsDialogTitle = ({
  title,
  mode,
  canDelete,
  onDelete,
}: ProjectsDialogTitleProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')

  const heading =
    mode === 'view'
      ? title
      : t('dashboard.projectsTable.drawer.editProjectTitle')

  if (isDesktop) {
    // The dialog's title sets the type; this only keeps a long name shrinkable.
    return <Name>{heading}</Name>
  }

  return (
    <Flex justify="between" align="center" gap="2" width="100%">
      <Text as="span" style={{ minWidth: 0 }}>
        {heading}
      </Text>
      {canDelete && (
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
      )}
    </Flex>
  )
}

const Name = styled.span`
  min-width: 0;
`
