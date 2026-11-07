import { useStoreMap } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { TimeDateRangePicker } from './time-date-range-picker'
import { TimeNoteInput } from './time-note-input'
import { TimeProjectsSelect } from './time-projects-select'
import { TimeTwoSideInput } from './time-two-side-input'

import { $timeFilters } from '@/entities/time'
import { Text, workspaceDesign } from '@/shared'

/**
 * The feed's filters, applied as they change.
 *
 * Two rows: what the work was (project, date, note) above how active it was
 * (the four numeric ranges), so no field is squeezed to a sliver.
 */
export const TimeFilters = () => {
  const { t } = useTranslation()

  const activeDateId = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: (filters) => (filters.fromAt ? 'toAt' : 'fromAt'),
  })

  return (
    <Root>
      <Fields>
        <Field data-role="project">
          <TimeProjectsSelect />
        </Field>
        <Field data-role="date">
          <Group>
            <Text
              size={'2'}
              weight={'medium'}
              as="label"
              htmlFor={activeDateId}
            >
              {t('dashboard.page.filters.date')}
            </Text>
            <Pair>
              <TimeDateRangePicker />
            </Pair>
          </Group>
        </Field>
        <Field data-role="note">
          <TimeNoteInput />
        </Field>
        <Field data-role="range">
          <TimeTwoSideInput
            label={t('dashboard.page.filters.timeActive')}
            leftId="timeActiveMin"
            rightId="timeActiveMax"
            inputMode="numeric"
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightPlaceholder={t('dashboard.page.filters.max')}
          />
        </Field>
        <Field data-role="range">
          <TimeTwoSideInput
            label={t('dashboard.page.filters.keyboard')}
            leftId="keyboardKeysMin"
            rightId="keyboardKeysMax"
            inputMode="numeric"
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightPlaceholder={t('dashboard.page.filters.max')}
          />
        </Field>
        <Field data-role="range">
          <TimeTwoSideInput
            label={t('dashboard.page.filters.mouse')}
            leftId="mouseKeysMin"
            rightId="mouseKeysMax"
            inputMode="numeric"
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightPlaceholder={t('dashboard.page.filters.max')}
          />
        </Field>
        <Field data-role="range">
          <TimeTwoSideInput
            label={t('dashboard.page.filters.mouseDistance')}
            leftId="mouseDistanceMin"
            rightId="mouseDistanceMax"
            inputMode="numeric"
            leftPlaceholder={t('dashboard.page.filters.min')}
            rightPlaceholder={t('dashboard.page.filters.max')}
          />
        </Field>
      </Fields>
    </Root>
  )
}

/* Sized by the panel it sits in rather than the viewport: the sidebar can
   collapse and hand the panel more room at the same window width. */
const Root = styled.div`
  container: time-filters / inline-size;
  min-width: 0;
`

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--ui-space-4) var(--ui-space-3);

  @container time-filters (max-width: ${workspaceDesign.container.compact}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @container time-filters (max-width: ${workspaceDesign.container.narrow}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Field = styled.div`
  min-width: 0;

  &[data-role='project'] {
    grid-column: span 3;
  }

  &[data-role='date'] {
    grid-column: span 5;
  }

  &[data-role='note'] {
    grid-column: span 4;
  }

  &[data-role='range'] {
    grid-column: span 3;
  }

  @container time-filters (max-width: ${workspaceDesign.container.compact}px) {
    &[data-role] {
      grid-column: span 1;
    }

    &[data-role='date'] {
      grid-column: 1 / -1;
    }
  }

  @container time-filters (max-width: ${workspaceDesign.container.narrow}px) {
    &[data-role] {
      grid-column: 1 / -1;
    }
  }
`

const Group = styled.div`
  display: grid;
  gap: var(--ui-space-2);
`

const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-2);
`
