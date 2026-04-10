import { useTranslation } from 'react-i18next'

import * as S from '../dashboard-styles.ts'

import type { WorklogFormFilters } from './types'

import { DatePickerInput } from '@/features/shared'

type ProjectOption = { value: string; label: string }

type WorklogsDesktopFiltersProps = {
  projectOptions: ProjectOption[]
  worklogProjects: string[]
  onWorklogProjectsChange: (value: string[]) => void
  fromDate: Date | undefined
  onFromDateChange: (value: Date | undefined) => void
  toDate: Date | undefined
  onToDateChange: (value: Date | undefined) => void
  worklogQuery: string
  onWorklogQueryChange: (value: string) => void
  formFilters: WorklogFormFilters
  onFormFiltersChange: (patch: Partial<WorklogFormFilters>) => void
}

export const WorklogsDesktopFilters = ({
  projectOptions,
  worklogProjects,
  onWorklogProjectsChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  worklogQuery,
  onWorklogQueryChange,
  formFilters,
  onFormFiltersChange,
}: WorklogsDesktopFiltersProps) => {
  const { t } = useTranslation()

  return (
    <S.DesktopOnly>
      <S.Filters>
        <S.Field $basis={180}>
          <S.Label>{t('dashboard.page.filters.projects')}</S.Label>
          <S.FilterMotionSelect
            title={t('dashboard.page.filters.projectsTitle')}
            multi
            options={projectOptions}
            value={worklogProjects}
            onChange={(v) => onWorklogProjectsChange(v as string[])}
            placeholder={t('dashboard.page.filters.allWorklogs')}
          />
        </S.Field>

        <S.Field $basis={200}>
          <S.Label>{t('dashboard.page.filters.date')}</S.Label>
          <S.Range>
            <DatePickerInput
              value={fromDate}
              onChange={onFromDateChange}
              placeholder={t('dashboard.page.filters.from')}
            />
            <DatePickerInput
              value={toDate}
              onChange={onToDateChange}
              placeholder={t('dashboard.page.filters.to')}
            />
          </S.Range>
        </S.Field>

        <S.Field $basis={240}>
          <S.Label>{t('dashboard.page.filters.note')}</S.Label>
          <S.Control
            value={worklogQuery}
            onChange={(e) => onWorklogQueryChange(e.target.value)}
            placeholder={t('dashboard.page.filters.searchNote')}
          />
        </S.Field>

        <S.Field>
          <S.Label>{t('dashboard.page.filters.timeActive')}</S.Label>
          <S.Range>
            <S.Control
              value={formFilters.timeActiveMin}
              onChange={(e) =>
                onFormFiltersChange({ timeActiveMin: e.target.value })
              }
              placeholder={t('dashboard.page.filters.min')}
            />
            <S.Control
              value={formFilters.timeActiveMax}
              onChange={(e) =>
                onFormFiltersChange({ timeActiveMax: e.target.value })
              }
              placeholder={t('dashboard.page.filters.max')}
            />
          </S.Range>
        </S.Field>

        <S.Field>
          <S.Label>{t('dashboard.page.filters.keyboard')}</S.Label>
          <S.Range>
            <S.Control
              value={formFilters.keyboardMin}
              onChange={(e) =>
                onFormFiltersChange({ keyboardMin: e.target.value })
              }
              placeholder={t('dashboard.page.filters.min')}
            />
            <S.Control
              value={formFilters.keyboardMax}
              onChange={(e) =>
                onFormFiltersChange({ keyboardMax: e.target.value })
              }
              placeholder={t('dashboard.page.filters.max')}
            />
          </S.Range>
        </S.Field>

        <S.Field>
          <S.Label>{t('dashboard.page.filters.mouse')}</S.Label>
          <S.Range>
            <S.Control
              value={formFilters.mouseMin}
              onChange={(e) =>
                onFormFiltersChange({ mouseMin: e.target.value })
              }
              placeholder={t('dashboard.page.filters.min')}
            />
            <S.Control
              value={formFilters.mouseMax}
              onChange={(e) =>
                onFormFiltersChange({ mouseMax: e.target.value })
              }
              placeholder={t('dashboard.page.filters.max')}
            />
          </S.Range>
        </S.Field>

        <S.Field>
          <S.Label>{t('dashboard.page.filters.mouseDistance')}</S.Label>
          <S.Range>
            <S.Control
              value={formFilters.mouseDistanceMin}
              onChange={(e) =>
                onFormFiltersChange({ mouseDistanceMin: e.target.value })
              }
              placeholder={t('dashboard.page.filters.min')}
            />
            <S.Control
              value={formFilters.mouseDistanceMax}
              onChange={(e) =>
                onFormFiltersChange({ mouseDistanceMax: e.target.value })
              }
              placeholder={t('dashboard.page.filters.max')}
            />
          </S.Range>
        </S.Field>
      </S.Filters>
    </S.DesktopOnly>
  )
}
