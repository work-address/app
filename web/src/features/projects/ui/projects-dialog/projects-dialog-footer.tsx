import { TrashIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProjectsDialogMode } from '../../model'

import { OpenInvoiceLink } from '@/features/invoice'
import { Button, PrintIcon, Text, useBreakpoint } from '@/shared'

type ProjectsDialogFooterProps = {
  mode: ProjectsDialogMode
  projectId?: string
  isPending: boolean
  onDelete: () => void
  onEdit: () => void
  onCancel: () => void
}

export const ProjectsDialogFooter = ({
  mode,
  projectId,
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

  const invoiceLink = projectId ? (
    <OpenInvoiceLink projectId={projectId} variant={'button'}>
      <Text size="2" as="span">
        {t('dashboard.projectsTable.drawer.invoice')}
      </Text>
      <img src={PrintIcon} alt="" width={28} height={28} />
    </OpenInvoiceLink>
  ) : null

  const editButton = (
    <Button iconLeft={<Pencil1Icon />} onClick={handleEditClick}>
      {t('dashboard.projectsTable.drawer.edit')}
    </Button>
  )

  if (isDesktop) {
    return (
      <Flex justify="between">
        <Button
          color="danger"
          variant="outline"
          iconLeft={<TrashIcon />}
          onClick={onDelete}
        >
          {t('common.delete')}
        </Button>
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
    return invoiceLink ? (
      <Grid columns="1fr 1fr" gap="2">
        {invoiceLink}
        {editButton}
      </Grid>
    ) : (
      editButton
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
