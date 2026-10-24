import { addDays, subDays } from 'date-fns'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  DATE_RANGE_PRESETS,
  MAX_RANGE_DAYS,
  fromDay,
  rangeLengthDays,
  resolveDateRange,
  toDay,
  weekStartsOnFor,
  type DateRange,
  type DateRangePreset,
} from '../lib/date-range'

import { DatePickerInput } from './date-picker-input'
import { Select } from './select'

type Props = {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const isPreset = (value: string): value is DateRangePreset =>
  (DATE_RANGE_PRESETS as readonly string[]).includes(value)

/**
 * A period for statistics: a named preset, or two days of the reader's
 * choosing. One component so the dashboard and the project dialog offer the
 * same periods and the same limits.
 */
export const DateRangePicker = ({ value, onChange, className }: Props) => {
  const { t, i18n } = useTranslation()

  const options = useMemo(
    () =>
      DATE_RANGE_PRESETS.map((preset) => ({
        value: preset,
        label: t(`common.dateRange.${preset}`),
      })),
    [t],
  )

  const choosePreset = (preset: DateRangePreset) => {
    // Custom starts from the days already shown, ready to adjust.
    onChange(
      preset === 'custom'
        ? { ...value, preset }
        : resolveDateRange(preset, new Date(), weekStartsOnFor(i18n.language)),
    )
  }

  // Moving one end past the other, or beyond the longest range the API
  // takes, drags the other end along instead of refusing the pick.
  const changeFrom = (date: Date | null) => {
    if (!date) {
      return
    }

    const from = toDay(date)
    let to = value.to

    if (from > to) {
      to = from
    } else if (rangeLengthDays({ from, to }) > MAX_RANGE_DAYS) {
      to = toDay(addDays(date, MAX_RANGE_DAYS - 1))
    }

    onChange({ preset: 'custom', from, to })
  }

  const changeTo = (date: Date | null) => {
    if (!date) {
      return
    }

    const to = toDay(date)
    let from = value.from

    if (to < from) {
      from = to
    } else if (rangeLengthDays({ from, to }) > MAX_RANGE_DAYS) {
      from = toDay(subDays(date, MAX_RANGE_DAYS - 1))
    }

    onChange({ preset: 'custom', from, to })
  }

  return (
    <Root className={className}>
      <PresetSelect
        label={t('common.dateRange.label')}
        options={options}
        value={value.preset}
        onChange={(next) => {
          if (typeof next === 'string' && isPreset(next)) {
            choosePreset(next)
          }
        }}
      />
      {value.preset === 'custom' && (
        <Days>
          <DatePickerInput
            id={'range-from'}
            label={t('common.dateRange.from')}
            value={fromDay(value.from)}
            onChange={changeFrom}
            allowClear={false}
          />
          <DatePickerInput
            id={'range-to'}
            label={t('common.dateRange.to')}
            value={fromDay(value.to)}
            onChange={changeTo}
            allowClear={false}
          />
        </Days>
      )}
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2);
`

const PresetSelect = styled(Select)`
  width: 180px;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
  }
`

const Days = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 150px);
  gap: var(--space-2);

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`
