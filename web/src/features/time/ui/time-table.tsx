import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getWorklogNavigationState,
  getWorklogSiblingId,
} from '../lib/get-worklog-sibling-id'

import { TimeContext } from './time-context'
import { TimeDialog } from './time-dialog/time-dialog'
import { TimeFilters } from './time-filters'
import { TimeMobileFilters } from './time-mobile-filters'
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
import * as S from '@/features/dashboard/components/dashboard-styles'
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
    if (setPaidStatusStatus === 'pending' || selectedWorklogsCount === 0) {
      return
    }

    setPaidStatus({ ids: selectedWorklogIds, isPaid })
  }

  const config = useMemo(
    (): DataTableConfig<Time> => [
      {
        dataKey: 'fromAt',
        headerText: t('dashboard.worklogsTable.head.date'),
        width: 165,
        sortable: true,
      },
      {
        customKey: 'projectName',
        getValue: (row: Time) => row.project?.title ?? '',
        headerText: t('dashboard.worklogsTable.head.projectName'),
        width: 229,
      },
      {
        customKey: 'paidStatus',
        headerText: t('dashboard.worklogsTable.head.paymentStatus'),
      },
      {
        dataKey: 'note',
        headerText: t('dashboard.worklogsTable.head.note'),
        sortable: true,
      },
      {
        dataKey: 'minutesActive',
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        horizontalAlign: 'center',
        width: 115,
        sortable: true,
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.worklogsTable.head.keyboard'),
        width: 100,
        sortable: true,
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
        width: 100,
        sortable: true,
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
        width: 140,
        sortable: true,
      },
      {
        dataKey: 'screenshot',
        headerText: t('dashboard.worklogsTable.head.screenshot'),
        horizontalAlign: 'end',
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
                themeVariant="primary"
                size="3"
                type="button"
                disabled={setPaidStatusStatus === 'pending'}
                onClick={() => handleBulkSetPaidStatus(true)}
              >
                {t('dashboard.worklogsTable.paymentStatus.paid')}
              </Button>
              <Button
                themeVariant="secondary"
                size="3"
                type="button"
                disabled={setPaidStatusStatus === 'pending'}
                onClick={() => handleBulkSetPaidStatus(false)}
              >
                {t('dashboard.worklogsTable.paymentStatus.unpaid')}
              </Button>
              <Button
                variant="outline"
                color="gray"
                size="3"
                type="button"
                disabled={setPaidStatusStatus === 'pending'}
                onClick={() => setSelectedIds({})}
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
