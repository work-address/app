import { TrashIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProjectsDialogMode } from '../model'

import { Button, useBreakpoint } from '@/shared'

type ProjectsDialogFooterProps = {
  mode: ProjectsDialogMode
  isPending: boolean
  onDelete: () => void
  onEdit: () => void
  onCancel: () => void
}

export const ProjectsDialogFooter = ({
  mode,
  isPending,
  onDelete,
  onEdit,
  onCancel,
}: ProjectsDialogFooterProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')

  const handleEditClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onEdit()
  }

  if (isDesktop) {
    return (
      <Flex justify="between">
        <Button
          color="danger"
          variant="outline"
          size="l"
          iconLeft={<TrashIcon />}
          onClick={onDelete}
        >
          {t('common.delete')}
        </Button>
        <Flex gap="3">
          {mode === 'view' ? (
            <Button
              size="l"
              iconLeft={<Pencil1Icon />}
              onClick={handleEditClick}
            >
              {t('dashboard.projectsTable.drawer.edit')}
            </Button>
          ) : (
            <>
              <Button
                color="neutral"
                variant="soft"
                size="l"
                onClick={onCancel}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="l"
                form="edit-project-form"
                type="submit"
                loading={isPending}
              >
                {t('common.save')}
              </Button>
            </>
          )}
        </Flex>
      </Flex>
    )
  }

  if (mode === 'view') {
    return (
      <Button iconLeft={<Pencil1Icon />} onClick={handleEditClick}>
        {t('dashboard.projectsTable.drawer.edit')}
      </Button>
    )
  }

  return (
    <Grid columns="1fr 1fr" gap="2">
      <Button color="neutral" variant="soft" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button
        form="edit-project-form"
        type="submit"
        loading={isPending}
        autoFocus={false}
      >
        {t('common.save')}
      </Button>
    </Grid>
  )
}
