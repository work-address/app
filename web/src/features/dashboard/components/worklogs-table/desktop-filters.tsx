import { Flex, Grid } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import * as S from '../dashboard-styles.ts'

import type { WorklogFormFilters } from './types'
import type { ChangeEvent } from 'react'

import {
  DatePickerInput,
  Input,
  type InputProps,
  Text,
} from '@/features/shared'

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

  const inputProps: InputProps = {
    columns: 'auto',
    rows: 'auto auto',
    gap: '2',
    textSize: '3',
  }

  return (
    <Flex gap={'3'} mb={'4'}>
      <S.Field $basis={180}>
        <Flex direction={'column'} gap={'2'}>
          <Text>{t('dashboard.page.filters.projects')}</Text>

          <S.FilterMotionSelect
            title={t('dashboard.page.filters.projectsTitle')}
            multi
            options={projectOptions}
            value={worklogProjects}
            onChange={(v) => onWorklogProjectsChange(v as string[])}
            placeholder={t('dashboard.page.filters.allWorklogs')}
          />
        </Flex>
      </S.Field>

      <S.Field $basis={200}>
        <Flex gap={'2'} direction={'column'}>
          <Text>{t('dashboard.page.filters.date')}</Text>

          <Grid columns={'1fr 1fr'} gap={'2'}>
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
          </Grid>
        </Flex>
      </S.Field>

      <S.Field $basis={240}>
        <Input
          label={t('dashboard.page.filters.note')}
          value={worklogQuery}
          onChange={(e) => onWorklogQueryChange(e.target.value)}
          {...inputProps}
        />
      </S.Field>

      <S.Field>
        <TwoSideInput
          label={t('dashboard.page.filters.timeActive')}
          leftValue={formFilters.timeActiveMin}
          onLeftChange={(e) =>
            onFormFiltersChange({ timeActiveMin: e.target.value })
          }
          rightValue={formFilters.timeActiveMax}
          onRightChange={(e) =>
            onFormFiltersChange({ timeActiveMax: e.target.value })
          }
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
          {...inputProps}
        />
      </S.Field>

      <S.Field>
        <TwoSideInput
          label={t('dashboard.page.filters.keyboard')}
          leftValue={formFilters.keyboardMin}
          rightValue={formFilters.keyboardMax}
          onLeftChange={(e) =>
            onFormFiltersChange({ keyboardMin: e.target.value })
          }
          onRightChange={(e) =>
            onFormFiltersChange({ keyboardMax: e.target.value })
          }
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>

      <S.Field>
        <TwoSideInput
          label={t('dashboard.page.filters.mouse')}
          leftValue={formFilters.mouseMin}
          rightValue={formFilters.mouseMax}
          onLeftChange={(e) =>
            onFormFiltersChange({ mouseMin: e.target.value })
          }
          onRightChange={(e) =>
            onFormFiltersChange({ mouseMax: e.target.value })
          }
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>

      <S.Field>
        <TwoSideInput
          label={t('dashboard.page.filters.mouseDistance')}
          leftValue={formFilters.mouseDistanceMin}
          rightValue={formFilters.mouseDistanceMax}
          onLeftChange={(e) =>
            onFormFiltersChange({ mouseDistanceMin: e.target.value })
          }
          onRightChange={(e) =>
            onFormFiltersChange({ mouseDistanceMax: e.target.value })
          }
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
    </Flex>
  )
}

type TwoSideInputProps = {
  label: string
  leftValue: string
  rightValue: string
  onLeftChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRightChange: (e: ChangeEvent<HTMLInputElement>) => void
  leftPlaceholder: string
  rightPlaceholder: string
}

const TwoSideInput = ({
  label,
  onLeftChange,
  onRightChange,
  leftValue,
  rightValue,
  leftPlaceholder,
  rightPlaceholder,
}: TwoSideInputProps) => {
  return (
    <Flex direction={'column'} gap={'2'}>
      <Text>{label}</Text>

      <Grid columns={'1fr 1fr'} gap={'2'}>
        <Input
          value={leftValue}
          onChange={onLeftChange}
          placeholder={leftPlaceholder}
          gap={'0'}
        />
        <Input
          value={rightValue}
          onChange={onRightChange}
          placeholder={rightPlaceholder}
          gap={'0'}
        />
      </Grid>
    </Flex>
  )
}
