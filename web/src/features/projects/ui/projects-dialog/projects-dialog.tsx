import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { $viewerOnlyProjectIds, mapAddressesToCollaborators } from '../../model'

import { ProjectsDialogFooter } from './projects-dialog-footer'
import { ProjectsDialogForm } from './projects-dialog-form'
import { ProjectsDialogTitle } from './projects-dialog-title'
import { ProjectsDialogView } from './projects-dialog-view'

import type { ProjectsDialogMode } from '../../model'

import { editProjectMutation, type ProjectWithStats } from '@/entities/projects'
import {
  AdaptiveDialog,
  DIALOG_WIDTH_STANDARD,
  DIALOG_WIDTH_WIDE,
} from '@/shared'

type ProjectsDialogProps = {
  open: boolean
  setOpen: (state: boolean) => void
  row?: ProjectWithStats | null
  onDeleteClick: (row?: ProjectWithStats | null) => void
}

export const ProjectsDialog = ({
  row,
  open,
  setOpen,
  onDeleteClick,
}: ProjectsDialogProps) => {
  const [modalMode, setModalMode] = useState<ProjectsDialogMode>('view')

  const { editingStatus, resetEditingMutation, viewerOnlyProjectIds } = useUnit(
    {
      editingStatus: editProjectMutation.$status,
      resetEditingMutation: editProjectMutation.reset,
      viewerOnlyProjectIds: $viewerOnlyProjectIds,
    },
  )

  useEffect(() => {
    if (!open) {
      return
    }

    if (editingStatus === 'done') {
      resetEditingMutation()
      setOpen(false)
    }
  }, [open, editingStatus, resetEditingMutation, setOpen])

  useEffect(() => {
    if (open) {
      setModalMode('view')
    }
  }, [open])

  return (
    <AdaptiveDialog
      title={
        <ProjectsDialogTitle
          title={row?.title}
          projectId={row?.id}
          canInvoice={!viewerOnlyProjectIds.includes(row?.id ?? '')}
          mode={modalMode}
          onDelete={() => onDeleteClick(row)}
        />
      }
      open={open}
      onOpenChange={setOpen}
      desktopWidth={
        modalMode === 'view' ? DIALOG_WIDTH_WIDE : DIALOG_WIDTH_STANDARD
      }
      footer={
        <ProjectsDialogFooter
          mode={modalMode}
          isPending={editingStatus === 'pending'}
          onDelete={() => row && onDeleteClick(row)}
          onEdit={() => setModalMode('edit')}
          onCancel={() => setModalMode('view')}
        />
      }
    >
      {row &&
        (modalMode === 'view' ? (
          <ProjectsDialogView data={row} />
        ) : (
          <ProjectsDialogForm
            projectId={row.id ?? ''}
            defaultValues={{
              title: row.title,
              state: row.state,
              rateHour: row.rateHour.toString(),
              text: row.text,
              collaborators: mapAddressesToCollaborators(
                row.workerAddresses,
                row.viewerAddresses,
              ),
              trackScreenshots: row.trackScreenshots ?? false,
              trackProcesses: row.trackProcesses ?? false,
            }}
          />
        ))}
    </AdaptiveDialog>
  )
}
