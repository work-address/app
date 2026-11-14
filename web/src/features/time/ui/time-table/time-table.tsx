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

import { TableAgentsContext, useTableAgentSummaries } from './time-table-agents'
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

/* With the AI agents column the others give it room, so the list still fits
   a 1280px window. */
const COLUMN_WIDTHS_WITH_AGENTS = {
  timeActive: 112,
  activity: 168,
  screenshot: 104,
  agents: 192,
  payment: 120,
  open: 40,
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

  // The column is there only while a loaded entry has agent runs.
  const agentSummaries = useTableAgentSummaries(entries)
  const hasAgents = agentSummaries.size > 0

  const widths = hasAgents ? COLUMN_WIDTHS_WITH_AGENTS : COLUMN_WIDTHS

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
        width: widths.timeActive,
        sortable: true,
      },
      {
        customKey: 'activity',
        headerText: t('dashboard.worklogsTable.head.activeMetrics'),
        width: widths.activity,
      },
      {
        dataKey: 'screenshot',
        headerText: t('dashboard.worklogsTable.head.screenshot'),
        description: t('common.metricDesc.screenshot'),
        width: widths.screenshot,
        sortable: true,
      },
      ...(hasAgents
        ? [
            {
              customKey: 'agents',
              headerText: t('dashboard.worklogsTable.agents.title'),
              description: t('time.list.agents.description'),
              width: COLUMN_WIDTHS_WITH_AGENTS.agents,
            },
          ]
        : []),
      {
        customKey: 'paidStatus',
        headerText: t('dashboard.worklogsTable.head.paymentStatus'),
        description: t('common.metricDesc.paymentStatus'),
        width: widths.payment,
        sortable: true,
      },
      {
        // The row opens the entry; the arrow only says so.
        customKey: 'open',
        headerText: '',
        horizontalAlign: 'end',
        width: widths.open,
      },
    ],
    [t, hasAgents, widths],
  )

  const readerId = reader?.id
  const canSelectRow = useCallback(
    (row: Time) => getEntryChanges(row, readerId).isAuthor,
    [readerId],
  )

  return (
    <TableAgentsContext.Provider value={agentSummaries}>
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
    </TableAgentsContext.Provider>
  )
}
