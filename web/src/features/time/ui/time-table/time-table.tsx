import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBulkDeleteTime, useTimeDialogNavigation } from '../../model'
import { TimeDialog } from '../time-dialog/time-dialog'
import { TimeFilters } from '../time-filters/time-filters'
import { TimeMobileFilters } from '../time-filters/time-mobile-filters'

import { TimeContext } from './time-context'
import { TimeMobileBulkActions } from './time-mobile-bulk-actions'
import { TimeTableCell } from './time-table-cell'

import {
  $allTime,
  $hasMoreTime,
  $isLoadingMoreTime,
  $isTimeFiltering,
  $timeSort,
  $timeLoading,
  loadMoreTime,
  setTimePaidStatusMutation,
  type Time,
  resetTimeSort,
  TimeEmptyState,
} from '@/entities/time'
import {
  Button,
  type DataTableConfig,
  DataTable,
  showToast,
  useBreakpoint,
  ListPageLayout as S,
} from '@/shared'

export const TimeTable = () => {
  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const {
    allTime: timeRows,
    timeLoading,
    isTimeFiltering,
    timeSort,
    resetTimeSortEvent,
    setPaidStatus,
    setPaidStatusStatus,
    resetSetPaidStatus,
    loadMore,
    isLoadingMoreTime,
    hasMoreTime,
  } = useUnit({
    allTime: $allTime,
    timeLoading: $timeLoading,
    isTimeFiltering: $isTimeFiltering,
    timeSort: $timeSort,
    resetTimeSortEvent: resetTimeSort,
    setPaidStatus: setTimePaidStatusMutation.start,
    setPaidStatusStatus: setTimePaidStatusMutation.$status,
    resetSetPaidStatus: setTimePaidStatusMutation.reset,
    loadMore: loadMoreTime,
    isLoadingMoreTime: $isLoadingMoreTime,
    hasMoreTime: $hasMoreTime,
  })

  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasTimeEntries = timeLoading || timeRows.length > 0

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [selectedTimeId, setSelectedTimeId] = useState<string | null>(null)
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)

  const selectedTimeIds = useMemo(
    () =>
      Object.entries(selectedIds)
        .filter(([, isSelected]) => Boolean(isSelected))
        .map(([id]) => id),
    [selectedIds],
  )
  const selectedTimeCount = selectedTimeIds.length

  const handleClearSelection = useCallback(() => {
    setSelectedIds({})
  }, [])

  const handleCloseDialog = useCallback(() => {
    setIsTimeDialogOpen(false)
    setSelectedTimeId(null)
  }, [])

  const { requestBulkDelete, isDeleting } = useBulkDeleteTime({
    selectedIds,
    selectedTimeId,
    isBlocked: setPaidStatusStatus === 'pending',
    onClearSelection: handleClearSelection,
    onCloseDialog: handleCloseDialog,
  })

  const isBulkPending = setPaidStatusStatus === 'pending' || isDeleting

  // Берём строку из стора по id, чтобы модалка видела актуальные данные после рефетча
  const selectedTimeEntry = useMemo(
    () => timeRows.find((row) => row.id === selectedTimeId) ?? null,
    [timeRows, selectedTimeId],
  )

  const handleOnSortChange = (sort: Record<string, 'ASC' | 'DESC'>) => {
    resetTimeSortEvent(sort)
  }

  const handleRowClick = useCallback((row: Time): void => {
    setSelectedTimeId(row.id ?? null)
    setIsTimeDialogOpen(true)
  }, [])

  const { hasPrev, hasNext, onPrev, onNext } = useTimeDialogNavigation({
    timeEntries: timeRows,
    selectedTimeId,
    isOpen: isTimeDialogOpen,
    hasMore: hasMoreTime,
    isLoadingMore: isLoadingMoreTime,
    onLoadMore: loadMore,
    onSelect: setSelectedTimeId,
  })

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
    if (isBulkPending || selectedTimeCount === 0) {
      return
    }

    setPaidStatus({ ids: selectedTimeIds, isPaid })
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
      {hasTimeEntries ? (
        <TimeContext.Provider value={timeContextValue}>
          {isDesktop && selectedTimeCount > 0 && (
            <Flex gap="2" align="center" mb="3">
              <S.Label>
                {t('dashboard.worklogsTable.bulk.selectedCount', {
                  count: selectedTimeCount,
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
                onClick={() => requestBulkDelete(selectedTimeIds)}
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
          {isMobile && selectedTimeCount > 0 && (
            <TimeMobileBulkActions
              selectedIds={selectedTimeIds}
              isPending={isBulkPending}
              onDelete={requestBulkDelete}
              onClearSelection={handleClearSelection}
            />
          )}
          <DataTable<Time>
            nowrap
            data={timeRows}
            config={config}
            getRowId={(row) => row.id ?? ''}
            BodyComponent={TimeTableCell}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            height={'70vh'}
            loading={timeLoading}
            isFiltering={isTimeFiltering}
            sort={timeSort}
            onSortChange={handleOnSortChange}
            onRowClick={handleRowClick}
            onReachEnd={loadMore}
            isLoadingMore={isLoadingMoreTime}
            skeletonHeight="40px"
          />
          <TimeDialog
            open={isTimeDialogOpen}
            row={selectedTimeEntry}
            onOpenChange={setIsTimeDialogOpen}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={onPrev}
            onNext={onNext}
          />
        </TimeContext.Provider>
      ) : (
        <Flex pt="7">
          <TimeEmptyState style={{ height: 560 }} />
        </Flex>
      )}
    </S.Section>
  )
}
