import { PersonIcon } from '@radix-ui/react-icons'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRunFilters } from '../model/agent-runs'
import type { Team } from '@/features/team'

import {
  type DateRange,
  type DateRangePreset,
  DateRangePicker,
  FolderIcon,
  Select,
  type SelectOption,
} from '@/shared'

const ALL = ''

const STATUSES = ['running', 'completed', 'cancelled', 'failed'] as const

type Props = {
  filters: AgentRunFilters
  preset: DateRangePreset
  team: Team | null
  onChange: (
    filters: Partial<AgentRunFilters>,
    preset?: DateRangePreset,
  ) => void
}

/** The projects, people and agents the reader may see runs of, from /team. */
export const getAgentFilterOptions = (
  team: Team | null,
  userId: string | undefined,
) => {
  const projects: SelectOption[] = []
  const people = new Map<string, string>()
  const agents = new Map<string, string>()
  for (const project of team?.projects ?? []) {
    if (!project.trackAgents) {
      continue
    }
    projects.push({ value: project.id, label: project.title })
    for (const person of project.people) {
      if (!person.userId || person.agents.length === 0) {
        continue
      }
      people.set(person.userId, person.name || person.address)
      if (userId && person.userId !== userId) {
        continue
      }
      for (const agent of person.agents) {
        agents.set(agent.id, agent.name)
      }
    }
  }
  const sorted = (map: Map<string, string>) =>
    [...map]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))

  return { projects, people: sorted(people), agents: sorted(agents) }
}

/**
 * Which runs the list shows: the days, then the project, person, agent, where
 * it ran and how it ended. Applied as they change, as every list filter is.
 */
export const AgentsFilters = ({ filters, preset, team, onChange }: Props) => {
  const { t } = useTranslation()

  const options = useMemo(
    () => getAgentFilterOptions(team, filters.userId),
    [team, filters.userId],
  )

  const single = (value: string | string[]) =>
    (Array.isArray(value) ? value[0] : value) || undefined

  const withAll = (label: string, list: SelectOption[]) => [
    { value: ALL, label },
    ...list,
  ]

  const range: DateRange = { preset, from: filters.from, to: filters.to }

  return (
    <Root>
      <Period
        value={range}
        labelHidden
        onChange={(next) =>
          onChange({ from: next.from, to: next.to }, next.preset)
        }
      />
      <Select
        label={t('agents.filters.project')}
        labelHidden
        icon={<FolderIcon />}
        options={withAll(t('dashboard.filters.allProjects'), options.projects)}
        value={filters.projectId ?? ALL}
        onChange={(value) => onChange({ projectId: single(value) })}
      />
      {options.people.length > 1 && (
        <Select
          label={t('agents.filters.person')}
          labelHidden
          icon={<PersonIcon />}
          options={withAll(t('dashboard.filters.everyone'), options.people)}
          value={filters.userId ?? ALL}
          // Another person's agents are not this one's: the agent is cleared too.
          onChange={(value) =>
            onChange({ userId: single(value), agentId: undefined })
          }
        />
      )}
      <Select
        label={t('agents.filters.agent')}
        labelHidden
        options={withAll(t('agents.filters.allAgents'), options.agents)}
        value={filters.agentId ?? ALL}
        onChange={(value) => onChange({ agentId: single(value) })}
      />
      <Select
        label={t('agents.filters.mode')}
        labelHidden
        options={[
          { value: ALL, label: t('agents.filters.anywhere') },
          { value: 'fixed', label: t('agents.mode.fixed') },
          { value: 'timer', label: t('agents.mode.timer') },
        ]}
        value={filters.mode ?? ALL}
        onChange={(value) =>
          onChange({ mode: single(value) as AgentRunFilters['mode'] })
        }
      />
      <Select
        label={t('agents.filters.status')}
        labelHidden
        options={[
          { value: ALL, label: t('agents.filters.anyStatus') },
          ...STATUSES.map((status) => ({
            value: status,
            label: t(`dashboard.worklogsTable.agents.status.${status}`),
          })),
        ]}
        value={filters.status ?? ALL}
        onChange={(value) => onChange({ status: single(value) })}
      />
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  align-items: end;
  gap: var(--ui-space-3);
  color: var(--ui-muted);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Period = styled(DateRangePicker)`
  --date-range-preset-width: 100%;

  grid-column: 1 / -1;
  justify-self: start;

  ${(p) => p.theme.breakpoints.down('md')} {
    justify-self: stretch;
  }
`
