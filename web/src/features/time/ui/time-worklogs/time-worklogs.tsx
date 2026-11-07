import { useUnit } from 'effector-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeDialogOpen,
  $selectedTimeCount,
  $selectedTimeEntry,
  $timeDialogNavigation,
  $timeFiltersOpen,
  $timeView,
  timeDialogNextRequested,
  timeDialogOpenChanged,
  timeDialogPrevRequested,
  timeFiltersOpenChanged,
} from '../../model'
import { TimeMobileBulkActions } from '../common'
import { TimeContext } from '../time-context'
import { TimeDialog } from '../time-dialog/time-dialog'
import { TimeFilters } from '../time-filters/time-filters'
import { TimeMobileFilters } from '../time-filters/time-mobile-filters'
import { TimeGrid } from '../time-grid'
import { TimeSortSelect } from '../time-sort-select'
import { TimeTable } from '../time-table/time-table'
import { TimeTableStack } from '../time-table/time-table-stack'
import { TimeViewToggle } from '../time-view-toggle'

import { TimeWorklogsBulkActions } from './time-worklogs-bulk-actions'
import { TimeWorklogsEmpty } from './time-worklogs-empty'

import {
  $allTime,
  $timeEntriesTotal,
  $timeLoading,
  $timeFailed,
  fetchTime,
} from '@/entities/time'
import {
  LoadFailure,
  WorkspacePageHeader,
  WorkspacePanel,
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
  const reducedMotion = useReducedMotion()

  const {
    entries,
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

  const list = isMobile ? <TimeTableStack /> : <TimeTable />

  return (
    <TimeContext.Provider value={contextValue}>
      <WorkspacePageHeader
        title={t('time.page.title')}
        description={t('time.page.description')}
        // Beside the title rather than inside a view: the list can also sort
        // from its column headers, and both write the same store.
        actions={
          <Actions>
            <TimeSortSelect />
            <TimeViewToggle />
          </Actions>
        }
      />
      <WorkspacePanel
        title={t('time.panel.title')}
        aside={
          showCount ? (
            <Count>{t('time.panel.count', { count: total })}</Count>
          ) : null
        }
        toolbar={
          <Toolbar>
            {isDesktop && <TimeFilters />}
            {isMobile && (
              <TimeMobileFilters
                filtersOpen={filtersOpen}
                onFiltersOpenChange={setFiltersOpen}
              />
            )}
            {hasEntries && !failed && selectedCount > 0 && (
              <>
                {isDesktop && <TimeWorklogsBulkActions />}
                {isMobile && <TimeMobileBulkActions />}
              </>
            )}
          </Toolbar>
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

/* Sort and view side by side; on a phone they share the row below the
   title, the picker taking what the toggle leaves. */
const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-flow: row;
    grid-template-columns: minmax(0, 1fr) auto;
  }
`

const Count = styled.span`
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
