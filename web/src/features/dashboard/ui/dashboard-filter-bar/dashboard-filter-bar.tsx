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
    <Root>
      <DateRangePicker value={range} onChange={changeRange} />
      <Field>
        <Select
          multi
          label={t('dashboard.filters.projects')}
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
            options={peopleOptions}
            value={userIds}
            placeholder={t('dashboard.filters.everyone')}
            allSelectedText={t('dashboard.filters.everyone')}
            onChange={(value) => changePeople(toIds(value))}
          />
        </Field>
      )}
    </Root>
  )
}

/* One row beside the title on a desktop. On a phone the period takes a line
   and projects and people share the next, so the filters cost two rows of the
   screen rather than three. */
const Root = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: end;
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);

    & > :first-child,
    & > :last-child:nth-child(2) {
      grid-column: 1 / -1;
    }
  }
`

const Field = styled.div`
  width: 200px;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: auto;
    min-width: 0;
  }
`
