import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $isTimeDialogOpen,
  $selectedTimeCount,
  $selectedTimeEntry,
  $selectedTimeIds,
  $timeDialogNavigation,
  $timeFiltersOpen,
  $timeView,
  $isTimeBulkPending,
  timeBulkDeleteRequested,
  timeDialogNextRequested,
  timeDialogOpenChanged,
  timeDialogPrevRequested,
  timeFiltersOpenChanged,
  timeSelectionCleared,
} from '../../model'
import { TimeMobileBulkActions } from '../common'
import { TimeContext } from '../time-context'
import { TimeDialog } from '../time-dialog/time-dialog'
import { TimeFilters } from '../time-filters/time-filters'
import { TimeMobileFilters } from '../time-filters/time-mobile-filters'
import { TimeGrid } from '../time-grid'
import { TimeTable } from '../time-table/time-table'
import { TimeViewToggle } from '../time-view-toggle'

import { TimeWorklogsBulkActions } from './time-worklogs-bulk-actions'

import { $allTime, $timeLoading, TimeEmptyState } from '@/entities/time'
import { ListPageLayout as S, useBreakpoint } from '@/shared'

const EMPTY_STATE_HEIGHT = 560

/**
 * The worklogs section: one set of filters, one selection and one dialog over
 * whichever presentation the reader picked.
 *
 * The chrome lives here rather than in either view so that switching between
 * them keeps the filters applied and the selection intact.
 */
export const TimeWorklogs = () => {
  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const {
    entries,
    loading,
    view,
    filtersOpen,
    setFiltersOpen,
    selectedCount,
    selectedIds,
    selectedEntry,
    isDialogOpen,
    setDialogOpen,
    navigation,
    goToPrev,
    goToNext,
    isBulkPending,
    requestBulkDelete,
    clearSelection,
  } = useUnit({
    entries: $allTime,
    loading: $timeLoading,
    view: $timeView,
    filtersOpen: $timeFiltersOpen,
    setFiltersOpen: timeFiltersOpenChanged,
    selectedCount: $selectedTimeCount,
    selectedIds: $selectedTimeIds,
    selectedEntry: $selectedTimeEntry,
    isDialogOpen: $isTimeDialogOpen,
    setDialogOpen: timeDialogOpenChanged,
    navigation: $timeDialogNavigation,
    goToPrev: timeDialogPrevRequested,
    goToNext: timeDialogNextRequested,
    isBulkPending: $isTimeBulkPending,
    requestBulkDelete: timeBulkDeleteRequested,
    clearSelection: timeSelectionCleared,
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
      <S.SectionTitleRow>
        <S.SectionTitle>{t('dashboard.page.worklogs.title')}</S.SectionTitle>
        <Actions>
          <TimeViewToggle />
          {isMobile && (
            <TimeMobileFilters
              filtersOpen={filtersOpen}
              onFiltersOpenChange={setFiltersOpen}
            />
          )}
        </Actions>
      </S.SectionTitleRow>
      {isDesktop && <TimeFilters />}
      {hasEntries ? (
        <TimeContext.Provider value={contextValue}>
          {isDesktop && selectedCount > 0 && <TimeWorklogsBulkActions />}
          {isMobile && selectedCount > 0 && (
            <TimeMobileBulkActions
              selectedIds={selectedIds}
              isPending={isBulkPending}
              onDelete={requestBulkDelete}
              onClearSelection={clearSelection}
            />
          )}
          {view === 'grid' ? <TimeGrid /> : <TimeTable />}
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

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-2);
`

const Empty = styled.div`
  display: grid;
  padding-top: var(--space-7);
`
