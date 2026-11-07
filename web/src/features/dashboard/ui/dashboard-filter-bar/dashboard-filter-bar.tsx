import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $dashboardPeople,
  $dashboardProjectIds,
  $dashboardRange,
  $dashboardUserIds,
  dashboardPeopleChanged,
  dashboardProjectsChanged,
  dashboardRangeChanged,
} from '../../model'

import { $projects } from '@/entities/projects'
import { DateRangePicker, Select } from '@/shared'

const toIds = (value: string | string[]) =>
  Array.isArray(value) ? value : value ? [value] : []

/**
 * The period, projects and people every figure on the dashboard follows. The
 * people filter only appears for someone with workers on their own projects.
 */
export const DashboardFilterBar = () => {
  const { t } = useTranslation()

  const {
    range,
    projectIds,
    userIds,
    projects,
    people,
    changeRange,
    changeProjects,
    changePeople,
  } = useUnit({
    range: $dashboardRange,
    projectIds: $dashboardProjectIds,
    userIds: $dashboardUserIds,
    projects: $projects,
    people: $dashboardPeople,
    changeRange: dashboardRangeChanged,
    changeProjects: dashboardProjectsChanged,
    changePeople: dashboardPeopleChanged,
  })

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id ?? '',
        label: project.title,
      })),
    [projects],
  )

  const peopleOptions = useMemo(
    () => people.map((person) => ({ value: person.id, label: person.name })),
    [people],
  )

  return (
    <Root data-custom={range.preset === 'custom' || undefined}>
      <Field>
        <Select
          multi
          label={t('dashboard.filters.projects')}
          labelHidden
          options={projectOptions}
          value={projectIds}
          placeholder={t('dashboard.filters.allProjects')}
          allSelectedText={t('dashboard.filters.allProjects')}
          onChange={(value) => changeProjects(toIds(value))}
        />
      </Field>
      {peopleOptions.length > 0 && (
        <Field>
          <Select
            multi
            label={t('dashboard.filters.people')}
            labelHidden
            options={peopleOptions}
            value={userIds}
            placeholder={t('dashboard.filters.everyone')}
            allSelectedText={t('dashboard.filters.everyone')}
            onChange={(value) => changePeople(toIds(value))}
          />
        </Field>
      )}
      <Period value={range} onChange={changeRange} labelHidden />
    </Root>
  )
}

const Root = styled.div`
  --select-trigger-height: var(--ui-filter-height);
  --select-trigger-padding: var(--ui-space-4);
  --select-trigger-radius: var(--ui-filter-radius);
  --select-trigger-border: var(--ui-line);
  --select-trigger-background: var(--ui-surface);
  --select-trigger-color: var(--ui-ink);
  --select-trigger-font-size: var(--ui-body-size);
  --select-trigger-hover-border: var(--ui-line);
  --select-trigger-hover-background: var(--ui-surface);

  display: grid;
  grid-auto-flow: column;
  justify-self: end;
  align-items: end;
  gap: var(--ui-space-3);
  max-width: 100%;
  color: var(--ui-muted);

  &[data-custom] {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, auto);
  }

  ${(p) => p.theme.breakpoints.down('xl')} {
    width: 100%;
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    &[data-custom] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`

const Field = styled.div`
  --select-trigger-background: transparent;
  --select-trigger-border: transparent;
  --select-trigger-color: var(--ui-muted);
  --select-trigger-padding: var(--ui-space-2);

  width: var(--ui-filter-width);

  ${(p) => p.theme.breakpoints.down('xl')} {
    width: auto;
    min-width: 0;
  }
`

const Period = styled(DateRangePicker)`
  justify-self: end;

  ${Root}[data-custom] & {
    grid-column: 1 / -1;
  }

  ${(p) => p.theme.breakpoints.down('xl')} {
    grid-column: 1 / -1;
    grid-auto-flow: row;
    justify-self: stretch;
  }
`
