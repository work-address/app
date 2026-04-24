import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import * as S from '../dashboard-styles.ts'
import { WorklogsEmptyState } from '../worklogs-empty-state.tsx'

import { BodyCellComponent } from './desktop-body-cell'
import { WorklogsDesktopFilters } from './desktop-filters'
import { WorklogsMobileFilters } from './mobile-filters'
import { WorklogsContext } from './worklogs-context'

import {
  $allWorklogs,
  $isWorklogsFiltering,
  $worklogSort,
  $worklogsLoading,
  type Time,
  resetWorklogSort,
} from '@/entities/activities'
import { type DataTableConfig, DataTable, useBreakpoint } from '@/shared'

export const WorklogsTable = () => {
  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')
  const isDesktop = useBreakpoint('isDesktop')

  const {
    allWorklogs: worklogRows,
    worklogsLoading: worklogsLoading,
    isWorklogsFiltering,
    worklogSort,
    resetWorklogSortEvent,
  } = useUnit({
    allWorklogs: $allWorklogs,
    worklogsLoading: $worklogsLoading,
    isWorklogsFiltering: $isWorklogsFiltering,
    worklogSort: $worklogSort,
    resetWorklogSortEvent: resetWorklogSort,
  })

  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasWorklogs = worklogsLoading || worklogRows.length > 0

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const handleOnSortChange = (sort: Record<string, 'ASC' | 'DESC'>) => {
    resetWorklogSortEvent(sort)
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
        getValue: (row: Time) => row.activity?.title ?? '',
        headerText: t('dashboard.worklogsTable.head.projectName'),
        width: 229,
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
        width: 103,
        sortable: true,
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
        width: 87,
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
        width: 114,
        horizontalAlign: 'center',
      },
      {
        customKey: 'actions',
        width: 64,
        headerText: '',
      },
    ],
    [t],
  )

  const worklogsContextValue = useMemo(
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
          <WorklogsMobileFilters
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
          />
        )}
      </S.SectionTitleRow>

      {isDesktop && <WorklogsDesktopFilters />}

      {hasWorklogs ? (
        <WorklogsContext.Provider value={worklogsContextValue}>
          <DataTable<Time>
            nowrap
            data={worklogRows}
            config={config}
            getRowId={(row) => row.id ?? ''}
            BodyComponent={BodyCellComponent}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            height={'72dvh'}
            loading={worklogsLoading}
            isFiltering={isWorklogsFiltering}
            sort={worklogSort}
            onSortChange={handleOnSortChange}
            skeletonHeight="40px"
          />
        </WorklogsContext.Provider>
      ) : (
        <WorklogsEmptyState />
      )}
    </S.Section>
  )
}

export type { PaymentStatus, WorklogFormFilters, WorklogRow } from './types'
