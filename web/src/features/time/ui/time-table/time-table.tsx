import { useUnit } from 'effector-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $timeSelection,
  getEntryChanges,
  getTimeDayKey,
  groupTimeByDay,
  timeRowClicked,
  timeSelectionChanged,
} from '../../model'
import { TimeDayHeading } from '../common'

import { TimeTableCell } from './time-table-cell'

import { $user } from '@/entities/profile'
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

/* The session column takes what the fixed columns leave, so the list fits a
   1280px window without scrolling sideways. Every other fact the old
   per-metric columns showed sits in the activity column, and the sort picker
   still sorts by each of them. */
const COLUMN_WIDTHS = {
  timeActive: 136,
  activity: 208,
  screenshot: 120,
  payment: 136,
  open: 48,
} as const

/** The list presentation of the worklogs feed. */
export const TimeTable = () => {
  const { t } = useTranslation()

  const {
    reader,
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
    reader: $user,
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
        headerText: t('time.list.session'),
        sortable: true,
      },
      {
        dataKey: 'minutesActive',
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        description: t('common.metricDesc.timeActive'),
        width: COLUMN_WIDTHS.timeActive,
        sortable: true,
      },
      {
        customKey: 'activity',
        headerText: t('dashboard.worklogsTable.head.activeMetrics'),
        width: COLUMN_WIDTHS.activity,
      },
      {
        dataKey: 'screenshot',
        headerText: t('dashboard.worklogsTable.head.screenshot'),
        description: t('common.metricDesc.screenshot'),
        width: COLUMN_WIDTHS.screenshot,
        sortable: true,
      },
      {
        customKey: 'paidStatus',
        headerText: t('dashboard.worklogsTable.head.paymentStatus'),
        description: t('common.metricDesc.paymentStatus'),
        width: COLUMN_WIDTHS.payment,
        sortable: true,
      },
      {
        // The row opens the entry; the arrow only says so.
        customKey: 'open',
        headerText: '',
        horizontalAlign: 'end',
        width: COLUMN_WIDTHS.open,
      },
    ],
    [t],
  )

  const readerId = reader?.id
  const canSelectRow = useCallback(
    (row: Time) => getEntryChanges(row, readerId).isAuthor,
    [readerId],
  )

  return (
    <DataTable<Time>
      shadow={false}
      rounded={false}
      data={entries}
      config={config}
      getRowId={(row) => row.id ?? ''}
      BodyComponent={TimeTableCell}
      allowSelection
      canSelectRow={canSelectRow}
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
