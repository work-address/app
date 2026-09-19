import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  isTimeBulkActionAvailable,
  TIME_BULK_ACTIONS,
  type TimeBulkAction,
} from '../../model'

import {
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
} from '@/entities/time'
import { Button, Select, Text, useConfirm } from '@/shared'

type TimeMobileBulkActionsProps = {
  selectedIds: string[]
  /** Whether a selected entry is on an invoice, which rules out delete. */
  hasInvoiced: boolean
  isPending: boolean
  onDelete: (ids: string[]) => void
  onClearSelection: () => void
}

export const TimeMobileBulkActions = ({
  selectedIds,
  hasInvoiced,
  isPending,
  onDelete,
  onClearSelection,
}: TimeMobileBulkActionsProps) => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [picked, setPicked] = useState<TimeBulkAction | ''>('')
  // What Apply runs: the pick, unless the selection has since ruled it out -
  // delete picked, then an invoiced entry selected - so a refused action is
  // never the one applied.
  const action =
    picked && isTimeBulkActionAvailable(picked, { hasInvoiced }) ? picked : ''

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

  // An invoice keeps the hours it bills, and the API refuses the whole
  // delete (409) if one selected entry is on an invoice - so, as on the
  // desktop bar, delete is listed but not offered, and the reason is shown
  // under the field: a phone has no hover for a tooltip.
  const actionOptions = useMemo(() => {
    const labels: Record<TimeBulkAction, string> = {
      delete: t('dashboard.worklogsTable.bulk.delete'),
      removeScreenshots: t('dashboard.worklogsTable.removeScreenshot'),
      removeProcesses: t('dashboard.worklogsTable.removeProcesses'),
    }

    return TIME_BULK_ACTIONS.map((value) => ({
      value,
      label: labels[value],
      disabled: !isTimeBulkActionAvailable(value, { hasInvoiced }),
    }))
  }, [t, hasInvoiced])

  useEffect(() => {
    if (removeScreenshotStatus === 'done') {
      resetRemoveScreenshot()
      setPicked('')
      onClearSelection()
    }
  }, [removeScreenshotStatus, resetRemoveScreenshot, onClearSelection])

  useEffect(() => {
    if (removeProcessesStatus === 'done') {
      resetRemoveProcesses()
      setPicked('')
      onClearSelection()
    }
  }, [removeProcessesStatus, resetRemoveProcesses, onClearSelection])

  useEffect(() => {
    if (selectedIds.length === 0) {
      setPicked('')
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

          setPicked(value as TimeBulkAction)
        }}
        placeholder={t('dashboard.worklogsTable.bulk.actionPlaceholder')}
      />
      {hasInvoiced && (
        <Text size="1" color="gray">
          {t('dashboard.worklogsTable.bulk.deleteInvoicedHint')}
        </Text>
      )}
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
