import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getWorklogNavigationState,
  getWorklogSiblingId,
  useBulkDeleteWorklogs,
} from '../../model'
import { TimeDialog } from '../time-dialog/time-dialog'
import { TimeFilters } from '../time-filters/time-filters'
import { TimeMobileFilters } from '../time-filters/time-mobile-filters'

import { TimeContext } from './time-context'
import { TimeTableCell } from './time-table-cell'

import {
  $allWorklogs,
  $isLoadingMoreWorklogs,
  $isWorklogsFiltering,
  $worklogSort,
  $worklogsLoading,
  loadMoreWorklogs,
  setWorklogPaidStatusMutation,
  type Time,
  resetWorklogSort,
} from '@/entities/time'
import { DashboardStyles as S } from '@/features/dashboard'
import {
  Button,
  type DataTableConfig,
  DataTable,
  showToast,
  useBreakpoint,
  WorklogsEmptyState,
} from '@/shared'

export const TimeTable = () => {
  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const {
    allWorklogs: worklogRows,
    worklogsLoading: worklogsLoading,
    isWorklogsFiltering,
    worklogSort,
    resetWorklogSortEvent,
    setPaidStatus,
    setPaidStatusStatus,
    resetSetPaidStatus,
    loadMore,
    isLoadingMoreWorklogs,
  } = useUnit({
    allWorklogs: $allWorklogs,
    worklogsLoading: $worklogsLoading,
    isWorklogsFiltering: $isWorklogsFiltering,
    worklogSort: $worklogSort,
    resetWorklogSortEvent: resetWorklogSort,
    setPaidStatus: setWorklogPaidStatusMutation.start,
    setPaidStatusStatus: setWorklogPaidStatusMutation.$status,
    resetSetPaidStatus: setWorklogPaidStatusMutation.reset,
    loadMore: loadMoreWorklogs,
    isLoadingMoreWorklogs: $isLoadingMoreWorklogs,
  })

  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasWorklogs = worklogsLoading || worklogRows.length > 0

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [selectedWorklogId, setSelectedWorklogId] = useState<string | null>(
    null,
  )
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)

  const selectedWorklogIds = useMemo(
    () =>
      Object.entries(selectedIds)
        .filter(([, isSelected]) => Boolean(isSelected))
        .map(([id]) => id),
    [selectedIds],
  )
  const selectedWorklogsCount = selectedWorklogIds.length

  const handleClearSelection = useCallback(() => {
    setSelectedIds({})
  }, [])

  const handleCloseDialog = useCallback(() => {
    setIsTimeDialogOpen(false)
    setSelectedWorklogId(null)
  }, [])

  const { requestBulkDelete, isDeleting } = useBulkDeleteWorklogs({
    selectedIds,
    selectedWorklogId,
    isBlocked: setPaidStatusStatus === 'pending',
    onClearSelection: handleClearSelection,
    onCloseDialog: handleCloseDialog,
  })

  const isBulkPending = setPaidStatusStatus === 'pending' || isDeleting

  // Берём строку из стора по id, чтобы модалка видела актуальные данные после рефетча
  const selectedWorklog = useMemo(
    () => worklogRows.find((row) => row.id === selectedWorklogId) ?? null,
    [worklogRows, selectedWorklogId],
  )

  const { hasPrev, hasNext } = useMemo(
    () => getWorklogNavigationState(worklogRows, selectedWorklogId),
    [worklogRows, selectedWorklogId],
  )

  const handleOnSortChange = (sort: Record<string, 'ASC' | 'DESC'>) => {
    resetWorklogSortEvent(sort)
  }

  const handleRowClick = useCallback((row: Time): void => {
    setSelectedWorklogId(row.id ?? null)
    setIsTimeDialogOpen(true)
  }, [])

  const goToSibling = useCallback(
    (direction: -1 | 1) => {
      const siblingId = getWorklogSiblingId(
        worklogRows,
        selectedWorklogId,
        direction,
      )

      if (!siblingId) {
        return
      }

      setSelectedWorklogId(siblingId)
    },
    [worklogRows, selectedWorklogId],
  )

  const handlePrevWorklog = useCallback(() => {
    goToSibling(-1)
  }, [goToSibling])

  const handleNextWorklog = useCallback(() => {
    goToSibling(1)
  }, [goToSibling])

  useEffect(() => {
    if (setPaidStatusStatus === 'done') {
      resetSetPaidStatus()
      setSelectedIds({})

      showToast('success', {
        message: t('dashboard.worklogsTable.paymentStatus.changed'),
        position: 'top-center',
      })
    }
  }, [t, setPaidStatusStatus, resetSetPaidStatus])

  const handleBulkSetPaidStatus = (isPaid: boolean) => {
    if (isBulkPending || selectedWorklogsCount === 0) {
      return
    }

    setPaidStatus({ ids: selectedWorklogIds, isPaid })
  }

  const config = useMemo(
    (): DataTableConfig<Time> => [
      {
        dataKey: 'fromAt',
        headerText: t('dashboard.worklogsTable.head.date'),
        width: 200,
        sortable: true,
      },
      {
        customKey: 'projectName',
        getValue: (row: Time) => row.project?.title ?? '',
        headerText: t('dashboard.worklogsTable.head.projectName'),
        width: 120,
        // TODO: support sorting
      },
      {
        customKey: 'paidStatus',
        headerText: t('dashboard.worklogsTable.head.paymentStatus'),
        width: 120,
        // TODO: support sorting
      },
      {
        dataKey: 'note',
        headerText: t('dashboard.worklogsTable.head.note'),
        width: 120,
        sortable: true,
      },
      {
        dataKey: 'minutesActive',
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        horizontalAlign: 'center',
        width: 120,
        sortable: true,
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.worklogsTable.head.keyboard'),
        width: 120,
        sortable: true,
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
        width: 120,
        sortable: true,
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
        width: 120,
        sortable: true,
      },
      {
        dataKey: 'screenshot',
        headerText: t('dashboard.worklogsTable.head.screenshot'),
        width: 120,
      },
    ],
    [t],
  )

  const timeContextValue = useMemo(
    () => ({
      dateFormatter: new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }),
      timeFormatter: new Intl.DateTimeFormat(i18n.language, {
        hour: 'numeric',
        minute: '2-digit',
      }),
      t,
    }),
    [i18n.language, t],
  )
  return (
    <S.Section>
      <S.SectionTitleRow>
        <S.SectionTitle>{t('dashboard.page.worklogs.title')}</S.SectionTitle>
        {isMobile && (
          <TimeMobileFilters
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
          />
        )}
      </S.SectionTitleRow>
      {isDesktop && <TimeFilters />}
      {hasWorklogs ? (
        <TimeContext.Provider value={timeContextValue}>
          {isDesktop && selectedWorklogsCount > 0 && (
            <Flex gap="2" align="center" mb="3">
              <S.Label>
                {t('dashboard.worklogsTable.bulk.selectedCount', {
                  count: selectedWorklogsCount,
                })}
              </S.Label>
              <Button
                size="l"
                type="button"
                disabled={isBulkPending}
                onClick={() => handleBulkSetPaidStatus(true)}
              >
                {t('dashboard.worklogsTable.paymentStatus.paid')}
              </Button>
              <Button
                color="neutral"
                variant="soft"
                size="l"
                type="button"
                disabled={isBulkPending}
                onClick={() => handleBulkSetPaidStatus(false)}
              >
                {t('dashboard.worklogsTable.paymentStatus.unpaid')}
              </Button>
              <Button
                color="danger"
                variant="outline"
                size="l"
                type="button"
                iconLeft={<TrashIcon />}
                disabled={isBulkPending}
                onClick={() => requestBulkDelete(selectedWorklogIds)}
              >
                {t('dashboard.worklogsTable.bulk.delete')}
              </Button>
              <Button
                variant="outline"
                color="neutral"
                size="l"
                type="button"
                disabled={isBulkPending}
                onClick={handleClearSelection}
              >
                {t('dashboard.worklogsTable.bulk.clearSelection')}
              </Button>
            </Flex>
          )}
          <DataTable<Time>
            nowrap
            data={worklogRows}
            config={config}
            getRowId={(row) => row.id ?? ''}
            BodyComponent={TimeTableCell}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            height={'70vh'}
            loading={worklogsLoading}
            isFiltering={isWorklogsFiltering}
            sort={worklogSort}
            onSortChange={handleOnSortChange}
            onRowClick={handleRowClick}
            onReachEnd={loadMore}
            isLoadingMore={isLoadingMoreWorklogs}
            skeletonHeight="40px"
          />
          <TimeDialog
            open={isTimeDialogOpen}
            row={selectedWorklog}
            onOpenChange={setIsTimeDialogOpen}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={handlePrevWorklog}
            onNext={handleNextWorklog}
          />
        </TimeContext.Provider>
      ) : (
        <Flex pt="7">
          <WorklogsEmptyState style={{ height: 560 }} />
        </Flex>
      )}
    </S.Section>
  )
}
