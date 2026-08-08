import { Grid } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useCallback } from 'react'

import type { InputProps } from '@/shared'

import {
  changeTimeFilters,
  $timeFilters,
  type TimeFilters,
} from '@/entities/time'
import { Input, Text } from '@/shared'

type TimeTwoSideInputProps = {
  label: string
  leftId: keyof TimeFilters
  leftPlaceholder: string
  rightId: keyof TimeFilters
  rightPlaceholder: string
  inputProps?: InputProps
  inputMode?: InputProps['inputMode']
}

export const TimeTwoSideInput = ({
  label,
  leftId,
  rightId,
  leftPlaceholder,
  rightPlaceholder,
  inputProps,
  inputMode,
}: TimeTwoSideInputProps) => {
  const leftValue = useStoreMap({
    store: $timeFilters,
    keys: [leftId],
    fn: (filters, [key]) => filters[key]?.toString() ?? '',
  })

  const rightValue = useStoreMap({
    store: $timeFilters,
    keys: [rightId],
    fn: (filters, [key]) => filters[key]?.toString() ?? '',
  })

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeTimeFilters,
  })

  const handleChange = useCallback(
    (key: keyof TimeFilters, value: string) => {
      const parsedValue = value ? Number(value) : ''
      const oldValue = key === leftId ? leftValue : rightValue

      changeFiltersEvent({
        [key]:
          typeof parsedValue === 'number' && isNaN(parsedValue)
            ? oldValue
            : parsedValue,
      })
    },
    [changeFiltersEvent, leftId, leftValue, rightValue],
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
          inputMode={inputMode}
        />
        <Input
          id={rightId}
          value={rightValue}
          onChange={(e) => handleChange(rightId, e.target.value)}
          placeholder={rightPlaceholder}
          {...inputProps}
          inputMode={inputMode}
        />
      </Grid>
    </Grid>
  )
}
