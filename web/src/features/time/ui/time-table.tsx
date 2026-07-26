import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TimeContext } from './time-context'
import { TimeDialog } from './time-dialog'
import { TimeFilters } from './time-filters'
import { TimeMobileFilters } from './time-mobile-filters'
import { TimeTableCell } from './time-table-cell'

import {
  $allWorklogs,
  $isWorklogsFiltering,
  $worklogSort,
  $worklogsLoading,
  type Time,
  resetWorklogSort,
} from '@/entities/time'
import * as S from '@/features/dashboard/components/dashboard-styles'
import {
  type DataTableConfig,
  DataTable,
  useBreakpoint,
  WorklogsEmptyState,
} from '@/shared'

export const TimeTable = () => {
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
  const [selectedWorklog, setSelectedWorklog] = useState<Time | null>(null)
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)

  const handleOnSortChange = (sort: Record<string, 'ASC' | 'DESC'>) => {
    resetWorklogSortEvent(sort)
  }

  const handleRowClick = useCallback((row: Time): void => {
    setSelectedWorklog(row)
    setIsTimeDialogOpen(true)
  }, [])

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
        getValue: (row: Time) => row.project?.title ?? '',
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
      {hasWorklogs ? (
        <TimeContext.Provider value={timeContextValue}>
          <DataTable<Time>
            nowrap
            data={worklogRows}
            config={config}
            getRowId={(row) => row.id ?? ''}
            BodyComponent={TimeTableCell}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            height={'70vh'}
            loading={worklogsLoading}
            isFiltering={isWorklogsFiltering}
            sort={worklogSort}
            onSortChange={handleOnSortChange}
            onRowClick={handleRowClick}
            skeletonHeight="40px"
          />
          <TimeDialog
            open={isTimeDialogOpen}
            row={selectedWorklog}
            onOpenChange={setIsTimeDialogOpen}
          />
        </TimeContext.Provider>
      ) : (
        <Flex pt="7">
          <WorklogsEmptyState style={{ height: 560 }} />
        </Flex>
      )}
    </S.Section>
  )
}
