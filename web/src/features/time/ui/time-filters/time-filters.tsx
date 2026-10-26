import { Grid } from '@radix-ui/themes'
import { useStoreMap } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { TimeDateRangePicker } from './time-date-range-picker'
import { TimeNoteInput } from './time-note-input'
import { TimeProjectsSelect } from './time-projects-select'
import { TimeTwoSideInput } from './time-two-side-input'

import { $timeFilters } from '@/entities/time'
import { Text } from '@/shared'

export const TimeFilters = () => {
  const { t } = useTranslation()

  const activeDateId = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: (filters) => (filters.fromAt ? 'toAt' : 'fromAt'),
  })

  return (
    <Root>
      <Field>
        <TimeProjectsSelect />
      </Field>
      <Field data-span="2">
        <Grid gap={'2'}>
          <Text size={'2'} weight={'medium'} as="label" htmlFor={activeDateId}>
            {t('dashboard.page.filters.date')}
          </Text>
          <Grid columns={'1fr 1fr'} gap={'2'}>
            <TimeDateRangePicker />
          </Grid>
        </Grid>
      </Field>
      <Field>
        <TimeNoteInput />
      </Field>
      <Field>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.timeActive')}
          leftId="timeActiveMin"
          rightId="timeActiveMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </Field>
      <Field>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.keyboard')}
          leftId="keyboardKeysMin"
          rightId="keyboardKeysMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </Field>
      <Field>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.mouse')}
          leftId="mouseKeysMin"
          rightId="mouseKeysMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </Field>
      <Field>
        <TimeTwoSideInput
          label={t('dashboard.page.filters.mouseDistance')}
          leftId="mouseDistanceMin"
          rightId="mouseDistanceMax"
          inputMode="numeric"
          leftPlaceholder={t('dashboard.page.filters.min')}
          rightPlaceholder={t('dashboard.page.filters.max')}
        />
      </Field>
    </Root>
  )
}

/* Fields wrap onto a second line when the page runs narrow, rather than
   squeezing until a date field shows three characters of its placeholder. */
const Root = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
`

/* The date field holds two inputs, so it takes two columns. */
const Field = styled.div`
  min-width: 0;

  &[data-span='2'] {
    grid-column: span 2;
  }
`
