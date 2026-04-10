import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import * as S from '../dashboard-styles.ts'
import { WorklogsEmptyState } from '../worklogs-empty-state.tsx'

import { BodyCellComponent } from './desktop-body-cell'
import { WorklogsDesktopFilters } from './desktop-filters'
import { WorklogsMobileFilters } from './mobile-filters'

import type { WorklogFormFilters, WorklogRow } from './types'

import {
  type DataTableConfig,
  DataTable,
  useBreakpoints,
} from '@/features/shared'

const initialFormFilters = (): WorklogFormFilters => ({
  timeActiveMin: '',
  timeActiveMax: '',
  keyboardMin: '',
  keyboardMax: '',
  mouseMin: '',
  mouseMax: '',
  mouseDistanceMin: '',
  mouseDistanceMax: '',
})

type WorklogsTableProps = {
  rows: WorklogRow[]
}

export const WorklogsTable = ({ rows }: WorklogsTableProps) => {
  const { t } = useTranslation()
  const { isMobile, isDesktop } = useBreakpoints()

  const [worklogQuery, setWorklogQuery] = useState('')
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)
  const [worklogProjects, setWorklogProjects] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [projectsDrawerOpen, setProjectsDrawerOpen] = useState(false)
  const [formFilters, setFormFilters] = useState(initialFormFilters)

  const projectOptions = useMemo(
    () => [
      {
        value: 'project-1',
        label: t('dashboard.page.filters.projectOption', { number: 1 }),
      },
      {
        value: 'project-2',
        label: t('dashboard.page.filters.projectOption', { number: 2 }),
      },
      {
        value: 'project-3',
        label: t('dashboard.page.filters.projectOption', { number: 3 }),
      },
      {
        value: 'project-4',
        label: t('dashboard.page.filters.projectOption', { number: 4 }),
      },
    ],
    [t],
  )

  const worklogRows = useMemo(() => {
    return rows.filter((w) => {
      const q = worklogQuery.trim().toLowerCase()
      if (!q) {
        return true
      }
      return w.note.toLowerCase().includes(q)
    })
  }, [rows, worklogQuery])

  const hasWorklogs = worklogRows.length > 0

  const selectedProjectsLabel = useMemo(() => {
    if (worklogProjects.length === 0) {
      return t('dashboard.page.filters.allWorklogs')
    }
    const selected = projectOptions
      .filter((o) => worklogProjects.includes(o.value))
      .map((o) => o.label)

    return selected.length <= 2
      ? selected.join(', ')
      : `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`
  }, [projectOptions, t, worklogProjects])

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const config = useMemo(
    (): DataTableConfig<WorklogRow> => [
      {
        dataKey: 'date',
        headerText: 'Date',
        width: 165,
      },
      {
        dataKey: 'projectName',
        headerText: 'Project name',
        width: 229,
      },
      {
        dataKey: 'note',
        headerText: 'Note',
      },
      {
        dataKey: 'timeActive',
        headerText: 'Time active',
        horizontalAlign: 'center',
        width: 115,
      },
      {
        dataKey: 'paymentStatus',
        headerText: 'Payment status',
        horizontalAlign: 'center',
        width: 138,
      },
      {
        dataKey: 'keyboard',
        headerText: 'Keyboard',
        width: 103,
      },
      {
        dataKey: 'mouse',
        headerText: 'Mouse',
        width: 87,
      },
      {
        dataKey: 'mouseDistance',
        headerText: 'Mouse distance',
        width: 140,
      },
      {
        dataKey: 'screenshot',
        headerText: 'Screenshot',
        width: 114,
        horizontalAlign: 'center',
      },
      {
        customKey: 'actions',
        width: 64,
        headerText: '',
      },
    ],
    [],
  )

  const patchFormFilters = (patch: Partial<WorklogFormFilters>) => {
    setFormFilters((p) => ({ ...p, ...patch }))
  }

  return (
    <S.Section>
      <S.SectionTitleRow>
        <S.SectionTitle>{t('dashboard.page.worklogs.title')}</S.SectionTitle>

        {isMobile && (
          <WorklogsMobileFilters
            projectOptions={projectOptions}
            worklogProjects={worklogProjects}
            onToggleProject={(value) =>
              setWorklogProjects((prev) =>
                prev.includes(value)
                  ? prev.filter((v) => v !== value)
                  : [...prev, value],
              )
            }
            selectedProjectsLabel={selectedProjectsLabel}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            projectsDrawerOpen={projectsDrawerOpen}
            onProjectsDrawerOpenChange={setProjectsDrawerOpen}
            fromDate={fromDate}
            onFromDateChange={setFromDate}
            toDate={toDate}
            onToDateChange={setToDate}
            worklogQuery={worklogQuery}
            onWorklogQueryChange={setWorklogQuery}
            formFilters={formFilters}
            onFormFiltersChange={patchFormFilters}
          />
        )}
      </S.SectionTitleRow>

      {isDesktop && (
        <WorklogsDesktopFilters
          projectOptions={projectOptions}
          worklogProjects={worklogProjects}
          onWorklogProjectsChange={setWorklogProjects}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          worklogQuery={worklogQuery}
          onWorklogQueryChange={setWorklogQuery}
          formFilters={formFilters}
          onFormFiltersChange={patchFormFilters}
        />
      )}

      {hasWorklogs ? (
        <>
          <DataTable
            nowrap
            data={worklogRows}
            config={config}
            getRowId={(row) => row.key}
            BodyComponent={BodyCellComponent}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
          />
        </>
      ) : (
        <WorklogsEmptyState />
      )}
    </S.Section>
  )
}

export type { PaymentStatus, WorklogFormFilters, WorklogRow } from './types'
