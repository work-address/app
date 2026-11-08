import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { namesItsProduct } from '../model'

import type { TeamProjectData, TeamRole } from '../model'
import type { ReactNode } from 'react'

import {
  formatAddress,
  formatCurrency,
  WorkspacePanel,
  WorkspaceStatus,
} from '@/shared'

type Props = {
  project: TeamProjectData
  /** Beside the title: how an owner changes who is on the project. */
  actions?: ReactNode
}

const ROLE_KEYS: Record<TeamRole, string> = {
  owner: 'team.role.owner',
  worker: 'team.role.worker',
  viewer: 'team.role.viewer',
}

const money = (cents: number) => formatCurrency(cents / 100)

/** One project's people and, as far as this reader may see, their agents. */
export const TeamProject = ({ project, actions }: Props) => {
  const { t } = useTranslation()

  return (
    <WorkspacePanel
      title={project.title}
      description={
        project.trackAgents
          ? undefined
          : t(
              project.role === 'owner'
                ? 'team.project.recordingOffOwner'
                : 'team.project.recordingOff',
            )
      }
      aside={actions}
    >
      <People>
        {project.people.map((person) => (
          <Person key={person.address}>
            <Identity>
              <Name title={person.address}>
                {person.name || formatAddress(person.address)}
              </Name>
              <Meta>{t(ROLE_KEYS[person.role])}</Meta>
              {!person.userId && (
                <WorkspaceStatus tone="attention">
                  {t('team.person.notSignedIn')}
                </WorkspaceStatus>
              )}
            </Identity>
            {person.agents.length > 0 && (
              <Agents>
                {person.agents.map((agent) => (
                  <Agent key={agent.id}>
                    <AgentName>{agent.name}</AgentName>
                    {!namesItsProduct(agent.name, agent.product) && (
                      <Meta>{agent.product}</Meta>
                    )}
                    <Value>
                      {t('team.rate.value', {
                        rate: money(agent.rateHourCents),
                      })}
                    </Value>
                    {agent.rateHourCents === 0 && (
                      <WorkspaceStatus tone="attention">
                        {t('team.rate.notBilled')}
                      </WorkspaceStatus>
                    )}
                    {agent.lastRateChange && (
                      <Meta>
                        {t('team.rate.changed', {
                          from: money(agent.lastRateChange.fromCents),
                          date: new Date(
                            agent.lastRateChange.at,
                          ).toLocaleDateString(),
                        })}
                      </Meta>
                    )}
                  </Agent>
                ))}
              </Agents>
            )}
          </Person>
        ))}
      </People>
    </WorkspacePanel>
  )
}

const People = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Person = styled.li`
  display: grid;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3) 0;

  & + & {
    border-top: var(--ui-border-width) solid var(--ui-line);
  }

  &:first-child {
    padding-top: 0;
  }
`

const Identity = styled.div`
  display: flex;
  /* A name, a role and a status wrap as whole facts on a narrow screen, which
     a fixed grid cannot do without knowing which of them are present. */
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
`

const Name = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--ui-body-size);
  font-weight: var(--ui-weight-semibold);
  color: var(--ui-ink);
`

const Meta = styled.span`
  font-size: var(--ui-meta-size);
  color: var(--ui-muted);
`

const Agents = styled.ul`
  display: grid;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0 0 0 var(--ui-space-3);
  border-left: var(--ui-border-width) solid var(--ui-line);
  list-style: none;
`

const Agent = styled.li`
  display: flex;
  /* The same reason as Identity: optional facts wrap whole. */
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
`

const AgentName = styled.span`
  font-size: var(--ui-body-size);
  color: var(--ui-text);
`

const Value = styled.span`
  font-size: var(--ui-body-size);
  color: var(--ui-text);
  font-variant-numeric: tabular-nums;
`
