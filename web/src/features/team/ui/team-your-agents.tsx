import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  fetchTeam,
  namesItsProduct,
  ownAgentRows,
  ownAgentsQuery,
  ownsEveryProject,
  teamQuery,
} from '../model'

import { TeamAgentRate } from './team-agent-rate'
import { TeamServerSetup } from './team-server-setup'
import { TeamServers } from './team-servers'

import { $user } from '@/entities/profile'
import { WorkspacePanel } from '@/shared'

/**
 * Every agent the reader runs and what it costs on each project. An agent first
 * appears when it records, attached at $0: that is the case this exists for.
 */
export const TeamYourAgents = () => {
  const { t } = useTranslation()
  const { agents, team, user, pending, failed, retry } = useUnit({
    agents: ownAgentsQuery.$data,
    team: teamQuery.$data,
    user: $user,
    pending: ownAgentsQuery.$pending,
    failed: ownAgentsQuery.$failed,
    retry: fetchTeam,
  })

  const rows = useMemo(
    () => ownAgentRows(agents ?? [], team, user?.id),
    [agents, team, user?.id],
  )

  const ownsAll = ownsEveryProject(team)

  return (
    <WorkspacePanel
      title={t('team.yourAgents.title')}
      description={t(
        ownsAll
          ? 'team.yourAgents.descriptionOwner'
          : 'team.yourAgents.description',
      )}
      aside={
        team?.projects.length ? (
          <TeamServerSetup projects={team.projects} />
        ) : undefined
      }
      loading={pending && agents === null}
      failed={failed}
      onRetry={retry}
      empty={
        agents && rows.length === 0
          ? {
              title: t('team.yourAgents.empty.title'),
              description: t('team.yourAgents.empty.description'),
            }
          : undefined
      }
    >
      <List>
        {rows.map((agent) => (
          <Item key={agent.id}>
            <Heading>
              <Name>{agent.name}</Name>
              {!namesItsProduct(agent.name, agent.product) && (
                <Meta>{agent.product}</Meta>
              )}
            </Heading>
            {agent.attachments.length === 0 ? (
              <Meta>{t('team.yourAgents.unattached')}</Meta>
            ) : (
              <Rates>
                {agent.attachments.map((attachment) => (
                  <Rate key={attachment.projectId}>
                    <Meta>{attachment.projectTitle}</Meta>
                    <TeamAgentRate
                      projectId={attachment.projectId}
                      agentId={agent.id}
                      rateHourCents={attachment.rateHourCents}
                      label={t('team.rate.label', {
                        agent: agent.name,
                        project: attachment.projectTitle,
                      })}
                    />
                  </Rate>
                ))}
              </Rates>
            )}
          </Item>
        ))}
      </List>
      <TeamServers />
      {/* Every runtime's time is still recorded as unclassified, and it bills. */}
      <Note>
        {t(
          ownsAll
            ? 'team.yourAgents.unverifiedOwner'
            : 'team.yourAgents.unverified',
        )}
      </Note>
    </WorkspacePanel>
  )
}

const List = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  display: grid;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4) 0;

  & + & {
    border-top: var(--ui-border-width) solid var(--ui-line);
  }

  &:first-child {
    padding-top: 0;
  }
`

const Heading = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--ui-space-2);
`

const Name = styled.span`
  font-size: var(--ui-body-size);
  font-weight: var(--ui-weight-semibold);
  color: var(--ui-ink);
`

const Meta = styled.span`
  font-size: var(--ui-meta-size);
  color: var(--ui-muted);
`

const Rates = styled.div`
  display: grid;
  gap: var(--ui-space-3);
`

const Rate = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space-1);
  }
`

const Note = styled.p`
  margin: var(--ui-space-3) 0 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
`
