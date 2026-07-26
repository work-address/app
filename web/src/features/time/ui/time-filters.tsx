import { Flex, Grid } from '@radix-ui/themes'
import { useStoreMap } from 'effector-react'
import { useTranslation } from 'react-i18next'

import {
  DateRangePicker,
  TwoSideInput,
  ProjectsSelect,
  NoteInput,
} from './common'

import { $worklogsFilters } from '@/entities/time'
import * as S from '@/features/dashboard/components/dashboard-styles'
import { Text } from '@/shared'

export const TimeFilters = () => {
  const { t } = useTranslation()

  const activeDateId = useStoreMap({
    store: $worklogsFilters,
    keys: [],
    fn: (filters) => (filters.fromAt ? 'toAt' : 'fromAt'),
  })

  return (
    <Flex gap={'3'} mb={'4'}>
      <S.Field $basis={214}>
        <ProjectsSelect />
      </S.Field>
      <S.Field $basis={300}>
        <Flex gap={'2'} direction={'column'}>
          <Text weight={'medium'} as="label" htmlFor={activeDateId}>
            {t('dashboard.page.filters.date')}
          </Text>
          <Grid columns={'1fr 1fr'} gap={'2'}>
            <DateRangePicker />
          </Grid>
        </Flex>
      </S.Field>
      <S.Field $basis={214}>
        <NoteInput />
      </S.Field>
      <S.Field $basis={160}>
        <TwoSideInput
          label={t('dashboard.page.filters.timeActive')}
          leftId="timeActiveMin"
          rightId="timeActiveMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
      <S.Field $basis={160}>
        <TwoSideInput
          label={t('dashboard.page.filters.keyboard')}
          leftId="keyboardKeysMin"
          rightId="keyboardKeysMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
      <S.Field $basis={160}>
        <TwoSideInput
          label={t('dashboard.page.filters.mouse')}
          leftId="mouseKeysMin"
          rightId="mouseKeysMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </S.Field>
      <S.Field>
        <TwoSideInput
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
