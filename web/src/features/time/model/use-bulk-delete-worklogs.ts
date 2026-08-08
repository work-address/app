import { useUnit } from 'effector-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { deleteWorklogMutation } from '@/entities/time'
import { showToast, useConfirm } from '@/shared'

type UseBulkDeleteWorklogsParams = {
  selectedIds: Record<string, boolean>
  selectedWorklogId: string | null
  isBlocked?: boolean
  onClearSelection: () => void
  onCloseDialog: () => void
}

export const useBulkDeleteWorklogs = ({
  selectedIds,
  selectedWorklogId,
  isBlocked = false,
  onClearSelection,
  onCloseDialog,
}: UseBulkDeleteWorklogsParams) => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [isBulkInFlight, setIsBulkInFlight] = useState(false)

  const { deleteWorklogs, status, reset } = useUnit({
    deleteWorklogs: deleteWorklogMutation.start,
    status: deleteWorklogMutation.$status,
    reset: deleteWorklogMutation.reset,
  })

  const contextRef = useRef({
    selectedIds,
    selectedWorklogId,
    onClearSelection,
    onCloseDialog,
  })
  contextRef.current = {
    selectedIds,
    selectedWorklogId,
    onClearSelection,
    onCloseDialog,
  }

  useEffect(() => {
    if (!isBulkInFlight) {
      return
    }

    if (status === 'fail') {
      setIsBulkInFlight(false)
      return
    }

    if (status !== 'done') {
      return
    }

    const {
      selectedIds: ids,
      selectedWorklogId: openId,
      onClearSelection: clearSelection,
      onCloseDialog: closeDialog,
    } = contextRef.current

    const shouldCloseDialog = Boolean(openId && ids[openId])

    setIsBulkInFlight(false)
    reset()
    clearSelection()

    if (shouldCloseDialog) {
      closeDialog()
    }

    showToast('success', {
      message: t('dashboard.worklogsTable.bulk.deletedMessage'),
      position: 'top-center',
    })
  }, [isBulkInFlight, reset, status, t])

  const requestBulkDelete = useCallback(
    (ids: string[]) => {
      if (isBlocked || isBulkInFlight || ids.length === 0) {
        return
      }

      void confirm({
        title: t('dashboard.worklogsTable.bulk.confirmDelete.title'),
        description: t(
          'dashboard.worklogsTable.bulk.confirmDelete.description',
          {
            count: ids.length,
          },
        ),
        confirmLabel: t('dashboard.worklogsTable.bulk.confirmDelete.confirm'),
        cancelLabel: t('common.cancel'),
        onConfirm: () => {
          setIsBulkInFlight(true)
          deleteWorklogs(ids)
        },
      })
    },
    [confirm, deleteWorklogs, isBlocked, isBulkInFlight, t],
  )

  return {
    requestBulkDelete,
    isDeleting: isBulkInFlight,
  }
}
