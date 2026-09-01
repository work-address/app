import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
} from '@/entities/time'
import { Button, Select, Text, useConfirm } from '@/shared'

type BulkAction = 'delete' | 'removeScreenshots' | 'removeProcesses'

type TimeMobileBulkActionsProps = {
  selectedIds: string[]
  isPending: boolean
  onDelete: (ids: string[]) => void
  onClearSelection: () => void
}

export const TimeMobileBulkActions = ({
  selectedIds,
  isPending,
  onDelete,
  onClearSelection,
}: TimeMobileBulkActionsProps) => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [action, setAction] = useState<BulkAction | ''>('')

  const {
    removeScreenshots,
    removeProcesses,
    removeScreenshotStatus,
    removeProcessesStatus,
    resetRemoveScreenshot,
    resetRemoveProcesses,
  } = useUnit({
    removeScreenshots: removeTimeScreenshotMutation.start,
    removeProcesses: removeTimeProcessesMutation.start,
    removeScreenshotStatus: removeTimeScreenshotMutation.$status,
    removeProcessesStatus: removeTimeProcessesMutation.$status,
    resetRemoveScreenshot: removeTimeScreenshotMutation.reset,
    resetRemoveProcesses: removeTimeProcessesMutation.reset,
  })

  const isBusy =
    isPending ||
    removeScreenshotStatus === 'pending' ||
    removeProcessesStatus === 'pending'

  const actionOptions = useMemo(
    () => [
      {
        value: 'delete' satisfies BulkAction,
        label: t('dashboard.worklogsTable.bulk.delete'),
      },
      {
        value: 'removeScreenshots' satisfies BulkAction,
        label: t('dashboard.worklogsTable.removeScreenshot'),
      },
      {
        value: 'removeProcesses' satisfies BulkAction,
        label: t('dashboard.worklogsTable.removeProcesses'),
      },
    ],
    [t],
  )

  useEffect(() => {
    if (removeScreenshotStatus === 'done') {
      resetRemoveScreenshot()
      setAction('')
      onClearSelection()
    }
  }, [removeScreenshotStatus, resetRemoveScreenshot, onClearSelection])

  useEffect(() => {
    if (removeProcessesStatus === 'done') {
      resetRemoveProcesses()
      setAction('')
      onClearSelection()
    }
  }, [removeProcessesStatus, resetRemoveProcesses, onClearSelection])

  useEffect(() => {
    if (selectedIds.length === 0) {
      setAction('')
    }
  }, [selectedIds.length])

  const handleApply = () => {
    if (!action || isBusy || selectedIds.length === 0) {
      return
    }

    if (action === 'delete') {
      onDelete(selectedIds)
      return
    }

    if (action === 'removeScreenshots') {
      void confirm({
        title: t('dashboard.worklogsTable.confirmRemoveScreenshot.title'),
        description: t(
          'dashboard.worklogsTable.confirmRemoveScreenshot.description',
        ),
        confirmLabel: t(
          'dashboard.worklogsTable.confirmRemoveScreenshot.confirm',
        ),
        cancelLabel: t('common.cancel'),
        onConfirm: () => {
          removeScreenshots(selectedIds)
        },
      })
      return
    }

    void confirm({
      title: t('dashboard.worklogsTable.confirmRemoveProcesses.title'),
      description: t(
        'dashboard.worklogsTable.confirmRemoveProcesses.description',
      ),
      confirmLabel: t('dashboard.worklogsTable.confirmRemoveProcesses.confirm'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        removeProcesses(selectedIds)
      },
    })
  }

  return (
    <Flex direction="column" gap="2" mb="3" width="100%">
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.bulk.selectedCount', {
          count: selectedIds.length,
        })}
      </Text>
      <Select
        options={actionOptions}
        value={action}
        onChange={(value) => {
          if (Array.isArray(value) || value === '') {
            return
          }

          setAction(value as BulkAction)
        }}
        placeholder={t('dashboard.worklogsTable.bulk.actionPlaceholder')}
        inputProps={{
          gap: '9px',
          textSize: '3',
          textWeight: 'regular',
        }}
      />
      <Button
        stretch
        size="l"
        disabled={!action || isBusy}
        onClick={handleApply}
      >
        {t('common.apply')}
      </Button>
    </Flex>
  )
}
