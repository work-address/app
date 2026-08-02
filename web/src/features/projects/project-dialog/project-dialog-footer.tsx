import { TrashIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProjectDialogMode } from './types'

import { Button, Spinner, useBreakpoint } from '@/shared'

type ProjectDialogFooterProps = {
  mode: ProjectDialogMode
  isPending: boolean
  onDelete: () => void
  onEdit: () => void
  onCancel: () => void
}

export const ProjectDialogFooter = ({
  mode,
  isPending,
  onDelete,
  onEdit,
  onCancel,
}: ProjectDialogFooterProps) => {
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
          color="red"
          variant="outline"
          size="3"
          onClick={onDelete}
          type="button"
        >
          <TrashIcon />
          {t('common.delete')}
        </Button>
        <Flex gap="3">
          {mode === 'view' ? (
            <Button
              themeVariant="primary"
              size="3"
              onClick={handleEditClick}
              type="button"
            >
              <Pencil1Icon />
              {t('dashboard.projectsTable.drawer.edit')}
            </Button>
          ) : (
            <>
              <Button
                themeVariant="secondary"
                onClick={onCancel}
                size="3"
                type="button"
              >
                {t('common.cancel')}
              </Button>
              <Button
                themeVariant="primary"
                size="3"
                form="edit-project-form"
                type="submit"
                disabled={isPending}
              >
                {isPending && <Spinner color="#FFF" width="3px" />}
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
      <Button themeVariant="primary" onClick={handleEditClick} type="button">
        <Pencil1Icon />
        {t('dashboard.projectsTable.drawer.edit')}
      </Button>
    )
  }

  return (
    <Grid columns="1fr 1fr" gap="2">
      <Button themeVariant="secondary" onClick={onCancel} type="button">
        {t('common.cancel')}
      </Button>
      <Button
        themeVariant="primary"
        form="edit-project-form"
        type="submit"
        disabled={isPending}
        autoFocus={false}
      >
        {isPending && <Spinner width="2px" color="#FFF" size={15} />}
        {t('common.save')}
      </Button>
    </Grid>
  )
}
