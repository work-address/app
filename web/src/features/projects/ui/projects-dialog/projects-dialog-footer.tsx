import { FileTextIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProjectsDialogMode } from '../../model'

import { OpenInvoiceLink } from '@/features/invoice'
import { Button, useBreakpoint } from '@/shared'

type ProjectsDialogFooterProps = {
  mode: ProjectsDialogMode
  projectId?: string
  isPending: boolean
  canManage: boolean
  canInvoice: boolean
  onDelete: () => void
  onEdit: () => void
  onCancel: () => void
}

export const ProjectsDialogFooter = ({
  mode,
  projectId,
  isPending,
  canManage,
  canInvoice,
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

  const invoiceLink =
    projectId && canInvoice ? (
      <OpenInvoiceLink
        projectId={projectId}
        variant={'button'}
        iconLeft={<FileTextIcon />}
      >
        {t('dashboard.projectsTable.drawer.invoice')}
      </OpenInvoiceLink>
    ) : null

  const editButton = canManage ? (
    <Button iconLeft={<Pencil1Icon />} onClick={handleEditClick}>
      {t('dashboard.projectsTable.drawer.edit')}
    </Button>
  ) : null

  // A viewer has nothing to do here, and so no footer.
  if (mode === 'view' && !invoiceLink && !editButton) {
    return null
  }

  if (isDesktop) {
    return (
      <Flex justify={canManage ? 'between' : 'end'}>
        {canManage && (
          <Button
            color="danger"
            variant="outline"
            iconLeft={<TrashIcon />}
            onClick={onDelete}
          >
            {t('common.delete')}
          </Button>
        )}
        <Flex gap="3">
          {mode === 'view' ? (
            <>
              {invoiceLink}
              {editButton}
            </>
          ) : (
            <>
              <Button color="neutral" variant="soft" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button
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
    return invoiceLink && editButton ? (
      <Grid columns="1fr 1fr" gap="2">
        {invoiceLink}
        {editButton}
      </Grid>
    ) : (
      (invoiceLink ?? editButton)
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
