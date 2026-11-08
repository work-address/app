import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { TimeDateRangePicker } from './time-date-range-picker'
import { TimeNoteInput } from './time-note-input'
import { TimeProjectsSelect } from './time-projects-select'
import { TimeTwoSideInput } from './time-two-side-input'

import { workspaceDesign } from '@/shared'

/**
 * The page's scope, beside its title on a desktop: which project and which
 * days. Applied as they change, like every desktop filter.
 */
export const TimeScopeFilters = () => (
  <Scope>
    <ScopeProject>
      <TimeProjectsSelect labelHidden />
    </ScopeProject>
    <TimeDateRangePicker />
  </Scope>
)

/**
 * What the entries in the scope contain: their note and how active they were.
 * Applied as they change.
 */
export const TimeFilters = () => {
  const { t } = useTranslation()

  return (
    <Root>
      <Fields>
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

/* Page-level scope beside the title, in the shared field look and height. */
const Scope = styled.div`
  display: grid;
  grid-template-columns: repeat(3, var(--ui-filter-width));
  gap: var(--ui-space-3);
  justify-content: end;

  ${(p) => p.theme.breakpoints.down('xl')} {
    grid-template-columns: minmax(0, 1fr) repeat(2, minmax(0, 1fr));
    justify-content: stretch;
  }
`

const ScopeProject = styled.div`
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

  &[data-role='note'] {
    grid-column: span 4;
  }

  &[data-role='range'] {
    grid-column: span 2;
  }

  /* Narrower: the note on its own line, the ranges two by two. */
  @container time-filters (max-width: ${workspaceDesign.container.roomy}px) {
    &[data-role='note'] {
      grid-column: 1 / -1;
    }

    &[data-role='range'] {
      grid-column: span 3;
    }
  }

  @container time-filters (max-width: ${workspaceDesign.container.compact}px) {
    &[data-role] {
      grid-column: span 1;
    }

    &[data-role='note'] {
      grid-column: 1 / -1;
    }
  }

  @container time-filters (max-width: ${workspaceDesign.container.narrow}px) {
    &[data-role] {
      grid-column: 1 / -1;
    }
  }
`
