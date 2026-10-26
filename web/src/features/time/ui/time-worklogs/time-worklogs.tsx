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
import { TimeViewToggle } from '../time-view-toggle'

import { TimeWorklogsBulkActions } from './time-worklogs-bulk-actions'

import {
  $allTime,
  $timeLoading,
  $timeFailed,
  fetchTime,
  TimeEmptyState,
} from '@/entities/time'
import {
  ListPageLayout as S,
  LoadFailure,
  PageHeader,
  useBreakpoint,
} from '@/shared'

const EMPTY_STATE_HEIGHT = 560

/**
 * The worklogs page body: one set of filters, one selection and one dialog
 * over whichever presentation the reader picked.
 *
 * It owns the page header because the sort and view controls belong beside
 * the title, and only this component knows about them.
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

  return (
    <S.Section>
      <Header
        title={t('time.page.title')}
        description={t('time.page.description')}
        actions={
          <Actions>
            {/* Beside the toggle rather than inside a view: the list can also
                sort from its column headers, and both write the same store. */}
            {isDesktop && (
              <>
                <TimeSortSelect />
                <TimeViewToggle />
              </>
            )}
            {isMobile && (
              <TimeMobileFilters
                filtersOpen={filtersOpen}
                onFiltersOpenChange={setFiltersOpen}
              />
            )}
          </Actions>
        }
      />
      {/* A phone cannot fit all three controls beside the title - the last
          one used to land past the right edge of the screen. The filters
          button stays with the title; the sort picker and the view toggle
          take the row underneath. */}
      {isMobile && (
        <MobileToolbar>
          <TimeSortSelect />
          <TimeViewToggle />
        </MobileToolbar>
      )}
      {isDesktop && <TimeFilters />}
      {failed ? (
        <LoadFailure
          title={t('dashboard.worklogsTable.loadFailure.title')}
          onRetry={retry}
        />
      ) : hasEntries ? (
        <TimeContext.Provider value={contextValue}>
          {isDesktop && selectedCount > 0 && <TimeWorklogsBulkActions />}
          {isMobile && selectedCount > 0 && <TimeMobileBulkActions />}
          {/* The views cross-fade rather than snap: the same entries, a
              different shape. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.15 }}
            >
              {view === 'grid' ? <TimeGrid /> : <TimeTable />}
            </motion.div>
          </AnimatePresence>
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
      ) : (
        <Empty>
          <TimeEmptyState style={{ height: EMPTY_STATE_HEIGHT }} />
        </Empty>
      )}
    </S.Section>
  )
}

const Header = styled(PageHeader)`
  margin-bottom: var(--space-5);
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-2);
`

const MobileToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
`

const Empty = styled.div`
  display: grid;
  padding-top: var(--space-7);
`
