import { useUnit } from 'effector-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { deleteTimeMutation } from '@/entities/time'
import { showToast, useConfirm } from '@/shared'

type UseBulkDeleteTimeParams = {
  selectedIds: Record<string, boolean>
  selectedTimeId: string | null
  isBlocked?: boolean
  onClearSelection: () => void
  onCloseDialog: () => void
}

export const useBulkDeleteTime = ({
  selectedIds,
  selectedTimeId,
  isBlocked = false,
  onClearSelection,
  onCloseDialog,
}: UseBulkDeleteTimeParams) => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [isBulkInFlight, setIsBulkInFlight] = useState(false)

  const { deleteTimeEntries, status, reset } = useUnit({
    deleteTimeEntries: deleteTimeMutation.start,
    status: deleteTimeMutation.$status,
    reset: deleteTimeMutation.reset,
  })

  const contextRef = useRef({
    selectedIds,
    selectedTimeId,
    onClearSelection,
    onCloseDialog,
  })
  contextRef.current = {
    selectedIds,
    selectedTimeId,
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
      selectedTimeId: openId,
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
          deleteTimeEntries(ids)
        },
      })
    },
    [confirm, deleteTimeEntries, isBlocked, isBulkInFlight, t],
  )

  return {
    requestBulkDelete,
    isDeleting: isBulkInFlight,
  }
}
