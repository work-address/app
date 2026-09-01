import { useUnit } from 'effector-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $timeSelection,
  getTimeDayKey,
  groupTimeByDay,
  timeRowClicked,
  timeSelectionChanged,
} from '../../model'
import { TimeDayHeading } from '../common'

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
} from '@/entities/time'
import { type DataTableConfig, DataTable } from '@/shared'

const DATE_COLUMN_WIDTH = 200
const COLUMN_WIDTH = 120

/** The list presentation of the worklogs feed. */
export const TimeTable = () => {
  const { t } = useTranslation()

  const {
    entries,
    loading,
    isFiltering,
    sort,
    resetSort,
    loadMore,
    isLoadingMore,
    selection,
    changeSelection,
    rowClicked,
  } = useUnit({
    entries: $allTime,
    loading: $timeLoading,
    isFiltering: $isTimeFiltering,
    sort: $timeSort,
    resetSort: resetTimeSort,
    loadMore: loadMoreTime,
    isLoadingMore: $isLoadingMoreTime,
    selection: $timeSelection,
    changeSelection: timeSelectionChanged,
    rowClicked: timeRowClicked,
  })

  /**
   * Day headings only make sense while the feed is in date order - sorted by
   * keyboard keys, say, days interleave and every row would start its own
   * heading. The grid has no such fallback because grouping is its structure.
   */
  const dayGroups = useMemo(
    () => (sort.fromAt ? groupTimeByDay(entries) : []),
    [entries, sort.fromAt],
  )

  const groupsByDay = useMemo(
    () => new Map(dayGroups.map((group) => [group.day, group])),
    [dayGroups],
  )

  const renderGroupHeader = useCallback(
    (day: string) => {
      const group = groupsByDay.get(day)

      return group ? <TimeDayHeading group={group} /> : null
    },
    [groupsByDay],
  )

  const config = useMemo(
    (): DataTableConfig<Time> => [
      {
        dataKey: 'fromAt',
        headerText: t('dashboard.worklogsTable.head.date'),
        width: DATE_COLUMN_WIDTH,
        sortable: true,
      },
      {
        customKey: 'projectName',
        getValue: (row: Time) => row.project?.title ?? '',
        headerText: t('dashboard.worklogsTable.head.projectName'),
        width: COLUMN_WIDTH,
        sortable: true,
      },
      {
        customKey: 'paidStatus',
        headerText: t('dashboard.worklogsTable.head.paymentStatus'),
        description: t('common.metricDesc.paymentStatus'),
        width: COLUMN_WIDTH,
        sortable: true,
      },
      {
        dataKey: 'minutesActive',
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        description: t('common.metricDesc.timeActive'),
        horizontalAlign: 'center',
        width: COLUMN_WIDTH,
        sortable: true,
      },
      {
        dataKey: 'note',
        headerText: t('dashboard.worklogsTable.head.note'),
        width: COLUMN_WIDTH,
        sortable: true,
        truncate: true,
      },
      {
        dataKey: 'screenshot',
        headerText: t('dashboard.worklogsTable.head.screenshot'),
        description: t('common.metricDesc.screenshot'),
        width: COLUMN_WIDTH,
        sortable: true,
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.worklogsTable.head.keyboard'),
        description: t('common.metricDesc.keyboard'),
        width: COLUMN_WIDTH,
        sortable: true,
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
        description: t('common.metricDesc.mouse'),
        width: COLUMN_WIDTH,
        sortable: true,
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
        description: t('common.metricDesc.mouseDistance'),
        width: COLUMN_WIDTH,
        sortable: true,
      },
    ],
    [t],
  )

  return (
    <DataTable<Time>
      nowrap
      data={entries}
      config={config}
      getRowId={(row) => row.id ?? ''}
      BodyComponent={TimeTableCell}
      allowSelection
      selectedIds={selection}
      onSelectedIdsChange={changeSelection}
      loading={loading}
      isFiltering={isFiltering}
      sort={sort}
      onSortChange={resetSort}
      onRowClick={rowClicked}
      onReachEnd={loadMore}
      isLoadingMore={isLoadingMore}
      skeletonHeight="40px"
      getGroupKey={dayGroups.length > 0 ? getTimeDayKey : undefined}
      renderGroupHeader={renderGroupHeader}
    />
  )
}
