import { MixerHorizontalIcon } from '@radix-ui/react-icons'
import { useStoreMap, useUnit } from 'effector-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeDialogOpen,
  $selectedTimeCount,
  $selectedTimeEntry,
  $timeDialogNavigation,
  $timeFiltersOpen,
  $timeView,
  getTimeSelectedDay,
  timeDialogNextRequested,
  timeDialogOpenChanged,
  timeDialogPrevRequested,
  timeFiltersOpenChanged,
} from '../../model'
import { TimeMobileBulkActions } from '../common'
import { TimeContext } from '../time-context'
import { TimeDialog } from '../time-dialog/time-dialog'
import { TimeFilters, TimeScopeFilters } from '../time-filters/time-filters'
import { TimeMobileFilters } from '../time-filters/time-mobile-filters'
import { TimeGrid } from '../time-grid'
import { TimeSortSelect } from '../time-sort-select'
import { TimeTable } from '../time-table/time-table'
import { TimeTableStack } from '../time-table/time-table-stack'
import { TimeViewToggle } from '../time-view-toggle'
import { TimeWeek } from '../time-week/time-week'

import { TimeWorklogsBulkActions } from './time-worklogs-bulk-actions'
import { TimeWorklogsEmpty } from './time-worklogs-empty'

import {
  $allTime,
  $isTimeFiltering,
  $timeEntriesTotal,
  $timeLoading,
  $timeFailed,
  $timeFilters,
  fetchTime,
  type TimeFilters as TimeFilterValues,
} from '@/entities/time'
import {
  Button,
  LoadFailure,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspaceFreshness,
  useBreakpoint,
  workspaceDesign,
} from '@/shared'

/**
 * The worklogs page body: one set of filters, one selection and one dialog
 * over whichever presentation the reader picked.
 *
 * It owns the page header because the sort and view controls belong beside
 * the title, and only this component knows about them. It renders as
 * siblings of the page's grid, so the header and the panel share its gap.
 *
 * The chrome lives here rather than in either view so that switching between
 * them keeps the filters applied and the selection intact.
 */
export const TimeWorklogs = () => {
  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  // How many of the panel's own filters (note and activity) are set: shown
  // on its toggle, and enough to open it by default.
  const activityFilterCount = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: countActivityFilters,
  })
  const selectedDay = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: getTimeSelectedDay,
  })
  const [filtersShown, setFiltersShown] = useState(activityFilterCount > 0)
  const reducedMotion = useReducedMotion()

  const {
    entries,
    isFiltering,
    total,
    loading,
    failed,
    retry,
    view,
    filtersOpen,
    setFiltersOpen,
    selectedCount,
    selectedEntry,
    isDialogOpen,
    setDialogOpen,
    navigation,
    goToPrev,
    goToNext,
  } = useUnit({
    entries: $allTime,
    isFiltering: $isTimeFiltering,
    total: $timeEntriesTotal,
    loading: $timeLoading,
    failed: $timeFailed,
    retry: fetchTime,
    view: $timeView,
    filtersOpen: $timeFiltersOpen,
    setFiltersOpen: timeFiltersOpenChanged,
    selectedCount: $selectedTimeCount,
    selectedEntry: $selectedTimeEntry,
    isDialogOpen: $isTimeDialogOpen,
    setDialogOpen: timeDialogOpenChanged,
    navigation: $timeDialogNavigation,
    goToPrev: timeDialogPrevRequested,
    goToNext: timeDialogNextRequested,
  })

  const hasEntries = loading || entries.length > 0
  // The server's count of every matching entry, not the pages loaded so far.
  // Hidden while the first page is in flight or failed, where it would be a
  // stale answer to a different question.
  const showCount = !failed && !(loading && entries.length === 0)

  const contextValue = useMemo(
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
      dayFormatter: new Intl.DateTimeFormat(i18n.language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      // Tracked distance arrives with full float precision, which is noise at
      // a glance - round it off and group the digits.
      numberFormatter: new Intl.NumberFormat(i18n.language, {
        maximumFractionDigits: 0,
      }),
      t,
    }),
    [i18n.language, t],
  )

  const longDayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [i18n.language],
  )

  const showBulk = hasEntries && !failed && selectedCount > 0
  const showToolbar = isMobile || filtersShown || showBulk

  const list = isMobile ? <TimeTableStack /> : <TimeTable />

  return (
    <TimeContext.Provider value={contextValue}>
      <WorkspacePageHeader
        eyebrow={t('time.page.eyebrow')}
        title={t('time.page.title')}
        description={t('time.page.description')}
        // Whether the feed below is the server's latest answer: a request in
        // flight says so, and a failed one claims nothing.
        actions={
          <HeaderTools>
            <Freshness pending={loading || isFiltering} failed={failed} />
            {/* Which project and which days: the page's scope, beside its
                title as on the dashboard. A phone keeps every filter in its
                drawer. */}
            {isDesktop && <TimeScopeFilters />}
          </HeaderTools>
        }
      />
      <TimeWeek />
      <WorkspacePanel
        // One day picked: the list is that day's, and says so.
        title={
          selectedDay
            ? longDayFormatter.format(new Date(`${selectedDay}T00:00`))
            : t('time.panel.title')
        }
        // The feed's own controls sit on the feed: the count, then the order
        // (which the list's column headers also write) and the view.
        aside={
          <Tools>
            {showCount ? (
              <Count>{t('time.panel.count', { count: total })}</Count>
            ) : null}
            <Controls>
              {isDesktop && (
                <Button
                  variant="outline"
                  color="neutral"
                  iconLeft={<MixerHorizontalIcon />}
                  aria-expanded={filtersShown}
                  aria-controls="time-activity-filters"
                  onClick={() => setFiltersShown((shown) => !shown)}
                >
                  {t('dashboard.page.filters.title')}
                  {activityFilterCount > 0 ? (
                    <FilterCount>{activityFilterCount}</FilterCount>
                  ) : null}
                </Button>
              )}
              <TimeSortSelect />
              <TimeViewToggle />
            </Controls>
          </Tools>
        }
        // Nothing to hold (desktop filters folded, nothing selected): no
        // toolbar row at all, rather than an empty one.
        toolbar={
          showToolbar ? (
            <Toolbar>
              {isDesktop && filtersShown && (
                <div id="time-activity-filters">
                  <TimeFilters />
                </div>
              )}
              {isMobile && (
                <TimeMobileFilters
                  filtersOpen={filtersOpen}
                  onFiltersOpenChange={setFiltersOpen}
                />
              )}
              {showBulk && (
                <>
                  {isDesktop && <TimeWorklogsBulkActions />}
                  {isMobile && <TimeMobileBulkActions />}
                </>
              )}
            </Toolbar>
          ) : undefined
        }
      >
        {failed ? (
          <LoadFailure
            title={t('dashboard.worklogsTable.loadFailure.title')}
            onRetry={retry}
          />
        ) : hasEntries ? (
          // The views cross-fade rather than snap: the same entries, a
          // different shape.
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reducedMotion
                  ? 0
                  : workspaceDesign.motion.hoverDuration,
              }}
            >
              {view === 'grid' ? <TimeGrid /> : list}
            </motion.div>
          </AnimatePresence>
        ) : (
          <TimeWorklogsEmpty />
        )}
      </WorkspacePanel>
      <TimeDialog
        open={isDialogOpen}
        row={selectedEntry}
        onOpenChange={setDialogOpen}
        hasPrev={navigation.hasPrev}
        hasNext={navigation.hasNext}
        onPrev={goToPrev}
        onNext={goToNext}
      />
    </TimeContext.Provider>
  )
}

/** The panel's own filters that are set: the note and each numeric bound. */
const countActivityFilters = (filters: TimeFilterValues) =>
  [
    filters.note,
    filters.timeActiveMin,
    filters.timeActiveMax,
    filters.keyboardKeysMin,
    filters.keyboardKeysMax,
    filters.mouseKeysMin,
    filters.mouseKeysMax,
    filters.mouseDistanceMin,
    filters.mouseDistanceMax,
  ].filter((value) => value !== null && value !== undefined && value !== '')
    .length

/* The status above the scope filters, both on the right; below xl they take
   the header's own row, the status first. */
const HeaderTools = styled.div`
  display: grid;
  justify-items: end;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('xl')} {
    justify-items: stretch;
  }
`

const Freshness = styled(WorkspaceFreshness)`
  ${(p) => p.theme.breakpoints.down('xl')} {
    justify-self: start;
  }
`

const FilterCount = styled.span`
  min-width: var(--ui-space-5);
  padding-inline: var(--ui-space-1);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-small-size);
  line-height: var(--ui-space-5);
  text-align: center;
`

/* Count first, then the controls; on a narrow panel the controls take the
   line below the title on their own. */
const Tools = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: end;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-flow: row;
    justify-content: stretch;
    width: 100%;
  }
`

const Controls = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--ui-space-3);

  /* A phone panel is too narrow for both on one line. */
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-flow: row;
    justify-items: start;
  }
`

const Count = styled.span`
  justify-self: start;
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Toolbar = styled.div`
  display: grid;
  gap: var(--ui-space-4);
  min-width: 0;
`
