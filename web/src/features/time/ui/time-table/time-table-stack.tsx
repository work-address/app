import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { Fragment, useContext, useMemo } from 'react'
import styled from 'styled-components'

import {
  $timeSelection,
  getTimeDayKey,
  getEntryChanges,
  getTimeSelectAllState,
  groupTimeByDay,
  timeRowClicked,
  timeSelectionChanged,
  toggleTimeSelectAll,
} from '../../model'
import { TimeDayHeading } from '../common'
import { TimeContext } from '../time-context'

import { TableAgentsContext, useTableAgentSummaries } from './time-table-agents'
import { TimeTableStackRow } from './time-table-stack-row'

import { $user } from '@/entities/profile'
import {
  $allTime,
  $isLoadingMoreTime,
  $isTimeFiltering,
  $timeLoading,
  $timeSort,
  loadMoreTime,
} from '@/entities/time'
import { Checkbox, Spinner, usePageBusy, useReachEnd } from '@/shared'

const PLACEHOLDER_ROW_COUNT = 6

/**
 * The list on a phone: one readable block per entry instead of a nine-column
 * table scrolled sideways. Every column's fact stays, labelled, and the
 * selection, payment toggle and paging behave as they do in the table.
 */
export const TimeTableStack = () => {
  const { t } = useContext(TimeContext)

  const {
    reader,
    entries,
    loading,
    isFiltering,
    sort,
    loadMore,
    isLoadingMore,
    selection,
    changeSelection,
    openEntry,
  } = useUnit({
    reader: $user,
    entries: $allTime,
    loading: $timeLoading,
    isFiltering: $isTimeFiltering,
    sort: $timeSort,
    loadMore: loadMoreTime,
    isLoadingMore: $isLoadingMoreTime,
    selection: $timeSelection,
    changeSelection: timeSelectionChanged,
    openEntry: timeRowClicked,
  })

  usePageBusy(isFiltering)

  const sentinelRef = useReachEnd({
    onReachEnd: loadMore,
    resetKey: entries.length,
  })

  // As in the table: days only head the list while it is in date order.
  const groupsByDay = useMemo(
    () =>
      sort.fromAt
        ? new Map(groupTimeByDay(entries).map((group) => [group.day, group]))
        : null,
    [entries, sort.fromAt],
  )

  const ids = useMemo(
    () =>
      entries.flatMap((entry) =>
        entry.id && getEntryChanges(entry, reader?.id).isAuthor
          ? [entry.id]
          : [],
      ),
    [entries, reader?.id],
  )
  const allSelected = getTimeSelectAllState(ids, selection)

  const agentSummaries = useTableAgentSummaries(entries)

  if (loading && entries.length === 0) {
    return (
      <Root aria-hidden="true">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          <Placeholder key={index}>
            <Skeleton height="20px" width="60%" />
            <Skeleton height="16px" width="40%" />
            <Skeleton height="16px" width="80%" />
          </Placeholder>
        ))}
      </Root>
    )
  }

  return (
    <TableAgentsContext.Provider value={agentSummaries}>
      <Root data-filtering={isFiltering || undefined}>
        {ids.length > 0 && (
          <Header>
            <Checkbox
              checked={allSelected}
              aria-label={t('ui.table.selectAll')}
              onCheckedChange={() =>
                changeSelection(toggleTimeSelectAll(ids, selection))
              }
            />
            <Caption>{t('time.list.selectAll')}</Caption>
          </Header>
        )}
        <List>
          {entries.map((entry, index) => {
            const day = getTimeDayKey(entry)
            const group =
              groupsByDay &&
              (index === 0 || getTimeDayKey(entries[index - 1]) !== day)
                ? groupsByDay.get(day)
                : undefined

            return (
              <Fragment key={entry.id ?? index}>
                {group && (
                  <Day>
                    <TimeDayHeading group={group} />
                  </Day>
                )}
                <TimeTableStackRow
                  entry={entry}
                  selected={Boolean(entry.id && selection[entry.id])}
                  onOpen={openEntry}
                  onSelectedChange={(id) =>
                    changeSelection({ ...selection, [id]: !selection[id] })
                  }
                />
              </Fragment>
            )
          })}
        </List>
        {isLoadingMore && (
          <Footer>
            <Spinner size={32} />
          </Footer>
        )}
        <Sentinel ref={sentinelRef} />
      </Root>
    </TableAgentsContext.Provider>
  )
}

const Root = styled.div`
  display: grid;
  min-width: 0;

  &[data-filtering] {
    opacity: 0.6;
    pointer-events: none;
  }
`

const Header = styled.label`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-space-3);
  padding-bottom: var(--ui-space-3);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
`

const Caption = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const List = styled.div`
  display: grid;
`

const Day = styled.div`
  padding: var(--ui-space-5) 0 var(--ui-space-2);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
`

const Placeholder = styled.div`
  display: grid;
  gap: var(--ui-space-2);
  padding-block: var(--ui-space-4);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
`

const Footer = styled.div`
  display: grid;
  place-items: center;
  padding: var(--ui-space-6) 0;
`

const Sentinel = styled.div`
  height: 1px;
`
