import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { mapAddressesToCollaborators } from '../add-collaborators'

import { ProjectDialogFooter } from './project-dialog-footer'
import { ProjectDialogForm } from './project-dialog-form'
import { ProjectDialogTitle } from './project-dialog-title'
import { ProjectDialogView } from './project-dialog-view'

import type { ProjectDialogMode } from './types'

import { editProjectMutation, type ProjectWithStats } from '@/entities/projects'
import { AdaptiveDialog } from '@/shared'

type ProjectDialogProps = {
  open: boolean
  setOpen: (state: boolean) => void
  row?: ProjectWithStats | null
  onDeleteClick: (row?: ProjectWithStats | null) => void
}

export const ProjectDialog = ({
  row,
  open,
  setOpen,
  onDeleteClick,
}: ProjectDialogProps) => {
  const [modalMode, setModalMode] = useState<ProjectDialogMode>('view')

  const { editingStatus, resetEditingMutation } = useUnit({
    editingStatus: editProjectMutation.$status,
    resetEditingMutation: editProjectMutation.reset,
  })

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
        <ProjectDialogTitle
          title={row?.title}
          projectId={row?.id}
          mode={modalMode}
          onDelete={() => onDeleteClick(row)}
        />
      }
      open={open}
      onOpenChange={setOpen}
      desktopWidth="600px"
      footer={
        <ProjectDialogFooter
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
          <ProjectDialogView data={row} />
        ) : (
          <ProjectDialogForm
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
