import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { mapAddressesToCollaborators } from '../../model'

import { ProjectsDialogFooter } from './projects-dialog-footer'
import { ProjectsDialogForm } from './projects-dialog-form'
import { ProjectsDialogTitle } from './projects-dialog-title'
import { ProjectsDialogView } from './projects-dialog-view'

import type { ProjectsDialogMode } from '../../model'

import {
  canInvoiceProject,
  canManageProject,
  editProjectMutation,
  type ProjectWithStats,
} from '@/entities/projects'
import { AdaptiveDialog, DIALOG_WIDTH_WIDE } from '@/shared'

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
        <ProjectsDialogTitle
          title={row?.title}
          mode={modalMode}
          canDelete={canManageProject(row?.role)}
          onDelete={() => onDeleteClick(row)}
        />
      }
      open={open}
      onOpenChange={setOpen}
      desktopWidth={DIALOG_WIDTH_WIDE}
      footer={
        <ProjectsDialogFooter
          mode={modalMode}
          projectId={row?.id}
          isPending={editingStatus === 'pending'}
          canManage={canManageProject(row?.role)}
          canInvoice={canInvoiceProject(row?.role)}
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
              rateHour: row.rateHour?.toString() ?? '',
              text: row.text,
              collaborators: mapAddressesToCollaborators(
                row.workerAddresses,
                row.viewerAddresses,
              ),
              trackScreenshots: row.trackScreenshots ?? false,
              trackProcesses: row.trackProcesses ?? false,
              trackAgents: row.trackAgents ?? false,
              trackWindowTitles: row.trackWindowTitles ?? false,
              trackBrowserDomains: row.trackBrowserDomains ?? false,
              allowManualTime: row.allowManualTime ?? false,
              allowMobileTime: row.allowMobileTime ?? false,
              reviewWindowHours: row.reviewWindowHours ?? 24,
            }}
          />
        ))}
    </AdaptiveDialog>
  )
}
