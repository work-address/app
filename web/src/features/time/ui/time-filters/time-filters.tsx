import { Flex, Grid } from '@radix-ui/themes'
import { useStoreMap } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { TimeDateRangePicker } from './time-date-range-picker'
import { TimeNoteInput } from './time-note-input'
import { TimeProjectsSelect } from './time-projects-select'
import { TimeTwoSideInput } from './time-two-side-input'

import { $timeFilters } from '@/entities/time'
import { DashboardStyles as S } from '@/features/dashboard'
import { Text } from '@/shared'

export const TimeFilters = () => {
  const { t } = useTranslation()

  const activeDateId = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: (filters) => (filters.fromAt ? 'toAt' : 'fromAt'),
  })

  return (
    <Flex gap={'3'} mb={'4'}>
      <S.Field $basis={214}>
        <TimeProjectsSelect />
      </S.Field>
      <S.Field $basis={300}>
        <Flex gap={'2'} direction={'column'}>
          <Text weight={'medium'} as="label" htmlFor={activeDateId}>
            {t('dashboard.page.filters.date')}
          </Text>
          <Grid columns={'1fr 1fr'} gap={'2'}>
            <TimeDateRangePicker />
          </Grid>
        </Flex>
      </S.Field>
      <S.Field $basis={214}>
        <TimeNoteInput />
      </S.Field>
      <S.Field $basis={160}>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.timeActive')}
          leftId="timeActiveMin"
          rightId="timeActiveMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
      <S.Field $basis={160}>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.keyboard')}
          leftId="keyboardKeysMin"
          rightId="keyboardKeysMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
      <S.Field $basis={160}>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.mouse')}
          leftId="mouseKeysMin"
          rightId="mouseKeysMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
      <S.Field>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.mouseDistance')}
          leftId="mouseDistanceMin"
          rightId="mouseDistanceMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
    </Flex>
  )
}
