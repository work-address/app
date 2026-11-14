import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import {
  $credentialRevoking,
  credentialRevokeRequested,
  credentialsQuery,
  ownAgentsQuery,
  serverCredentialRows,
  type CollectorHealth,
} from '../model'

import { routes } from '@/routes'
import { Button, WorkspaceStatus } from '@/shared'

const date = (value: string) => new Date(value).toLocaleDateString()

/**
 * The servers that may upload the reader's agent runs. Shown only once there
 * is one: someone whose agents all run on a laptop has nothing to manage here.
 */
export const TeamServers = () => {
  const { t } = useTranslation()
  const { credentials, agents, revoking, revoke } = useUnit({
    credentials: credentialsQuery.$data,
    agents: ownAgentsQuery.$data,
    revoking: $credentialRevoking,
    revoke: credentialRevokeRequested,
  })

  const rows = useMemo(
    () => serverCredentialRows(credentials ?? [], Date.now()),
    [credentials],
  )

  if (rows.length === 0) {
    return null
  }

  // A server's runs: its agent's, which the setup bound to the server's id.
  const runsOf = (instanceId: string) => {
    const agent = agents?.find((item) => item.bindings?.includes(instanceId))
    const query = new URLSearchParams({ mode: 'fixed' })
    if (agent) {
      query.set('agent', agent.id)
    }

    return `${routes.agents.build()}?${query}`
  }

  const healthText = (health: CollectorHealth) =>
    [
      t('team.servers.health.queued', { count: health.queued }),
      health.heldRuns > 0 &&
        t('team.servers.health.held', { count: health.heldRuns }),
      health.rejected > 0 &&
        t('team.servers.health.rejected', { count: health.rejected }),
      health.lost > 0 && t('team.servers.health.lost', { count: health.lost }),
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <Root>
      <Title>{t('team.servers.title')}</Title>
      <List>
        {rows.map((row) => {
          const label = row.label || t('team.servers.unnamed')

          return (
            <Item key={row.id}>
              <Identity>
                <Name>{label}</Name>
                <Meta>
                  {t('team.servers.key', { prefix: row.prefix })}
                  {' · '}
                  {row.lastUsedAt
                    ? t('team.servers.lastUsed', {
                        date: date(row.lastUsedAt),
                      })
                    : t('team.servers.neverUsed')}
                </Meta>
                {row.health ? (
                  <Meta
                    data-warn={
                      row.health.rejected > 0 ||
                      row.health.lost > 0 ||
                      undefined
                    }
                    title={
                      row.lastHealthAt
                        ? t('team.servers.health.reported', {
                            date: new Date(row.lastHealthAt).toLocaleString(),
                          })
                        : undefined
                    }
                  >
                    {healthText(row.health)}
                  </Meta>
                ) : null}
                <RunsLink to={runsOf(row.instanceId)}>
                  {t('team.servers.runs')}
                </RunsLink>
              </Identity>
              {row.state === 'active' ? (
                <Meta>
                  {t('team.servers.expires', { date: date(row.expiresAt) })}
                </Meta>
              ) : (
                <WorkspaceStatus
                  tone={row.state === 'expired' ? 'critical' : 'attention'}
                >
                  {t(
                    row.state === 'expired'
                      ? 'team.servers.expired'
                      : 'team.servers.expires',
                    { date: date(row.expiresAt) },
                  )}
                </WorkspaceStatus>
              )}
              <Button
                size="s"
                variant="soft"
                color="neutral"
                disabled={revoking}
                aria-label={t('team.servers.revoke.label', { label })}
                onClick={() => revoke({ id: row.id, label })}
              >
                {t('team.servers.revoke.action')}
              </Button>
            </Item>
          )
        })}
      </List>
    </Root>
  )
}

const Root = styled.section`
  display: grid;
  gap: var(--ui-space-3);
  margin-top: var(--ui-space-4);
  padding-top: var(--ui-space-4);
  border-top: var(--ui-border-width) solid var(--ui-line);
`

const Title = styled.h3`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  font-weight: var(--ui-weight-semibold);
`

const List = styled.ul`
  display: grid;
  gap: var(--ui-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--ui-space-3);

  ${(p) => p.theme.breakpoints.down('sm')} {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
    gap: var(--ui-space-2);
  }
`

const Identity = styled.div`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Name = styled.span`
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  overflow-wrap: anywhere;
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);

  /* Runs the collector could not deliver need someone to look. */
  &[data-warn] {
    color: var(--red-11);
  }
`

const RunsLink = styled(Link)`
  justify-self: start;
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`
