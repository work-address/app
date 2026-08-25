import { TrashIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $isTimeBulkPending,
  $isTimeDialogOpen,
  $selectedTimeCount,
  $selectedTimeEntry,
  $selectedTimeIds,
  $timeDialogNavigation,
  $timeFiltersOpen,
  $timeSelection,
  timeBulkDeleteRequested,
  timeBulkPaidStatusRequested,
  timeDialogNextRequested,
  timeDialogOpenChanged,
  timeDialogPrevRequested,
  timeFiltersOpenChanged,
  timeRowClicked,
  timeSelectionChanged,
  timeSelectionCleared,
} from '../../model'
import { TimeDialog } from '../time-dialog/time-dialog'
import { TimeFilters } from '../time-filters/time-filters'
import { TimeMobileFilters } from '../time-filters/time-mobile-filters'

import { TimeContext } from './time-context'
import { TimeMobileBulkActions } from './time-mobile-bulk-actions'
import { TimeTableCell } from './time-table-cell'

import {
  $allTime,
  $isLoadingMoreTime,
  $isTimeFiltering,
  $timeSort,
  $timeLoading,
  loadMoreTime,
  type Time,
  resetTimeSort,
  TimeEmptyState,
} from '@/entities/time'
import {
  Button,
  type DataTableConfig,
  DataTable,
  useBreakpoint,
  ListPageLayout as S,
} from '@/shared'

export const TimeTable = () => {
  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const {
    timeRows,
    timeLoading,
    isTimeFiltering,
    timeSort,
    resetTimeSortEvent,
    loadMore,
    isLoadingMoreTime,
    filtersOpen,
    setFiltersOpen,
    selection,
    changeSelection,
    clearSelection,
    selectedTimeIds,
    selectedTimeCount,
    selectedTimeEntry,
    isTimeDialogOpen,
    setDialogOpen,
    rowClicked,
    isBulkPending,
    requestBulkDelete,
    requestBulkPaidStatus,
    navigation,
    goToPrev,
    goToNext,
  } = useUnit({
    timeRows: $allTime,
    timeLoading: $timeLoading,
    isTimeFiltering: $isTimeFiltering,
    timeSort: $timeSort,
    resetTimeSortEvent: resetTimeSort,
    loadMore: loadMoreTime,
    isLoadingMoreTime: $isLoadingMoreTime,
    filtersOpen: $timeFiltersOpen,
    setFiltersOpen: timeFiltersOpenChanged,
    selection: $timeSelection,
    changeSelection: timeSelectionChanged,
    clearSelection: timeSelectionCleared,
    selectedTimeIds: $selectedTimeIds,
    selectedTimeCount: $selectedTimeCount,
    selectedTimeEntry: $selectedTimeEntry,
    isTimeDialogOpen: $isTimeDialogOpen,
    setDialogOpen: timeDialogOpenChanged,
    rowClicked: timeRowClicked,
    isBulkPending: $isTimeBulkPending,
    requestBulkDelete: timeBulkDeleteRequested,
    requestBulkPaidStatus: timeBulkPaidStatusRequested,
    navigation: $timeDialogNavigation,
    goToPrev: timeDialogPrevRequested,
    goToNext: timeDialogNextRequested,
  })

  const hasTimeEntries = timeLoading || timeRows.length > 0

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
        sortable: true,
      },
      {
        customKey: 'paidStatus',
        headerText: t('dashboard.worklogsTable.head.paymentStatus'),
        width: 120,
        sortable: true,
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
        sortable: true,
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
                onClick={() => requestBulkPaidStatus(true)}
              >
                {t('dashboard.worklogsTable.paymentStatus.paid')}
              </Button>
              <Button
                color="neutral"
                variant="soft"
                size="l"
                type="button"
                disabled={isBulkPending}
                onClick={() => requestBulkPaidStatus(false)}
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
                onClick={() => clearSelection()}
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
              onClearSelection={clearSelection}
            />
          )}
          <DataTable<Time>
            nowrap
            data={timeRows}
            config={config}
            getRowId={(row) => row.id ?? ''}
            BodyComponent={TimeTableCell}
            allowSelection
            selectedIds={selection}
            onSelectedIdsChange={changeSelection}
            height={'70vh'}
            loading={timeLoading}
            isFiltering={isTimeFiltering}
            sort={timeSort}
            onSortChange={resetTimeSortEvent}
            onRowClick={rowClicked}
            onReachEnd={loadMore}
            isLoadingMore={isLoadingMoreTime}
            skeletonHeight="40px"
          />
          <TimeDialog
            open={isTimeDialogOpen}
            row={selectedTimeEntry}
            onOpenChange={setDialogOpen}
            hasPrev={navigation.hasPrev}
            hasNext={navigation.hasNext}
            onPrev={goToPrev}
            onNext={goToNext}
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
