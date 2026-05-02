import { Grid } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { InputProps } from '@/shared'

import {
  changeWorklogFilters,
  $worklogsFilters,
  $activities,
  type WorklogsFilters,
} from '@/entities/activities'
import { Input, Text, DatePickerInput, Select } from '@/shared'

type TwoSideInputProps = {
  label: string
  leftId: keyof WorklogsFilters
  leftPlaceholder: string
  rightId: keyof WorklogsFilters
  rightPlaceholder: string
  type: 'string' | 'number'
  inputProps?: InputProps
}

export const TwoSideInput = ({
  label,
  leftId,
  rightId,
  leftPlaceholder,
  rightPlaceholder,
  type,
  inputProps,
}: TwoSideInputProps) => {
  const leftValue = useStoreMap({
    store: $worklogsFilters,
    keys: [leftId],
    fn: (filters, [key]) => filters[key]?.toString() ?? '',
  })

  const rightValue = useStoreMap({
    store: $worklogsFilters,
    keys: [rightId],
    fn: (filters, [key]) => filters[key]?.toString() ?? '',
  })

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeWorklogFilters,
  })

  const handleChange = useCallback(
    (key: keyof WorklogsFilters, value: string) => {
      const parsedValue = type === 'number' ? Number(value) : value
      const oldValue = key === leftId ? leftValue : rightValue

      changeFiltersEvent({
        [key]:
          typeof parsedValue === 'number' && isNaN(parsedValue)
            ? oldValue
            : parsedValue,
      })
    },
    [changeFiltersEvent, type, leftId, leftValue, rightValue],
  )

  return (
    <Grid columns={'auto'} gap={'2'}>
      <Text
        as={'label'}
        htmlFor={leftValue ? rightId : leftId}
        size={'2'}
        weight={'medium'}
      >
        {label}
      </Text>

      <Grid columns={'1fr 1fr'} gap={'2'}>
        <Input
          id={leftId}
          value={leftValue}
          onChange={(e) => handleChange(leftId, e.target.value)}
          placeholder={leftPlaceholder}
          {...inputProps}
        />

        <Input
          id={rightId}
          value={rightValue}
          onChange={(e) => handleChange(rightId, e.target.value)}
          placeholder={rightPlaceholder}
          {...inputProps}
        />
      </Grid>
    </Grid>
  )
}

export const DateRangePicker = () => {
  const { t } = useTranslation()

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeWorklogFilters,
  })

  const { fromAt, toAt } = useStoreMap({
    store: $worklogsFilters,
    keys: [],
    fn: (filters) => ({ fromAt: filters.fromAt, toAt: filters.toAt }),
  })

  const from = useMemo(() => (fromAt ? new Date(fromAt) : null), [fromAt])
  const to = useMemo(() => (toAt ? new Date(toAt) : null), [toAt])

  return (
    <>
      <DatePickerInput
        id={'fromAt'}
        value={from}
        onChange={(date) => changeFiltersEvent({ fromAt: date?.getTime() })}
        placeholder={t('dashboard.page.filters.from')}
      />

      <DatePickerInput
        id={'toAt'}
        value={to}
        onChange={(date) => changeFiltersEvent({ toAt: date?.getTime() })}
        placeholder={t('dashboard.page.filters.to')}
      />
    </>
  )
}

export const ProjectsSelect = () => {
  const { t } = useTranslation()

  const selectedActivity = useStoreMap({
    store: $worklogsFilters,
    keys: [],
    fn: (filters) => filters.activityId,
  })

  const { changeFiltersEvent, activities } = useUnit({
    changeFiltersEvent: changeWorklogFilters,
    activities: $activities,
  })

  const options = useMemo(
    () =>
      activities.map((activity) => ({
        value: activity.id ?? '',
        label: activity.title,
      })),
    [activities],
  )

  return (
    <Select
      label={t('dashboard.page.filters.projects')}
      options={options}
      value={selectedActivity ?? ''}
      onChange={(v) => {
        if (!Array.isArray(v)) {
          changeFiltersEvent({ activityId: v })
        }
      }}
      allSelectedText={t('dashboard.page.filters.allWorklogs')}
      placeholder={'Select projects'}
      inputProps={{
        gap: '9px',
        textSize: '3',
        textWeight: 'regular',
      }}
    />
  )
}

export const NoteInput = () => {
  const { t } = useTranslation()

  const value = useStoreMap({
    store: $worklogsFilters,
    keys: [],
    fn: (filters) => filters.note,
  })

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeWorklogFilters,
  })

  return (
    <Input
      label={'Note'}
      id={'note'}
      value={value ?? ''}
      placeholder={t('dashboard.page.filters.searchNote')}
      onChange={(e) => changeFiltersEvent({ note: e.target.value })}
      columns="1fr"
      rows="auto auto"
      gap="2"
      textSize="3"
      textWeight="regular"
    />
  )
}
