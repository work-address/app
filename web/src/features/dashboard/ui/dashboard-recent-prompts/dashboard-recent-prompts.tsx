import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import {
  $dashboardProjects,
  $dashboardUserIds,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'
import { DashboardWidget } from '../dashboard-widget'

import { recentAgentRunsQuery } from '@/entities/time'
import { routes } from '@/routes'
import { formatDurationFromMinutes, toDay } from '@/shared'

const VISIBLE_PROMPTS = 8

/**
 * The last prompts that started agent runs in the period. Another worker's
 * prompt stays held until their review window passes, and says so rather
 * than vanishing. Each opens the worklogs of its day and project.
 */
export const DashboardRecentPrompts = () => {
  const { t, i18n } = useTranslation()

  const { runs, projects, userIds, pending, failed, retry } = useUnit({
    runs: recentAgentRunsQuery.$data,
    projects: $dashboardProjects,
    userIds: $dashboardUserIds,
    pending: recentAgentRunsQuery.$pending,
    failed: recentAgentRunsQuery.$failed,
    retry: dashboardStatisticsRequested,
  })

  const titles = useMemo(
    () => new Map(projects.map((project) => [project.id, project.title])),
    [projects],
  )

  const visible = useMemo(() => {
    const people = new Set(userIds)

    return (runs ?? [])
      .filter((run) => run.prompt || run.promptPendingReview)
      .filter((run) => titles.has(run.projectId))
      .filter((run) => people.size === 0 || people.has(run.userId))
      .slice(0, VISIBLE_PROMPTS)
  }, [runs, titles, userIds])

  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [i18n.language],
  )

  return (
    <DashboardWidget
      title={t('dashboard.prompts.title')}
      loading={pending && runs === null}
      failed={failed}
      onRetry={retry}
      empty={
        runs && visible.length === 0
          ? {
              title: t('dashboard.prompts.empty.title'),
              description: t('dashboard.prompts.empty.description'),
            }
          : undefined
      }
    >
      <List>
        {visible.map((run) => {
          const day = toDay(new Date(run.fromAt))
          const minutes =
            (Date.parse(run.toAt) - Date.parse(run.fromAt)) / 60_000

          return (
            <li key={run.runKey}>
              <Item
                to={`${routes.time.build()}?${new URLSearchParams({
                  from: day,
                  to: day,
                  projects: run.projectId,
                })}`}
              >
                {run.prompt ? (
                  <Prompt>{run.prompt}</Prompt>
                ) : (
                  <Held>{t('dashboard.prompts.held')}</Held>
                )}
                <Meta>
                  {[
                    run.product,
                    titles.get(run.projectId),
                    formatDurationFromMinutes(
                      Math.max(1, Math.round(minutes)),
                      t,
                    ),
                    when.format(new Date(run.fromAt)),
                  ].join(' · ')}
                </Meta>
              </Item>
            </li>
          )
        })}
      </List>
    </DashboardWidget>
  )
}

const List = styled.ul`
  display: grid;
  margin: calc(var(--space-2) * -1) 0;
  padding: 0;
  list-style: none;

  li + li {
    border-top: 1px solid var(--ds-neutral-alpha-4);
  }
`

const Item = styled(Link)`
  display: grid;
  gap: 4px;
  padding: var(--space-2) 0;
  color: inherit;
  text-decoration: none;

  &:hover p,
  &:focus-visible p {
    text-decoration: underline;
  }
`

const Prompt = styled.p`
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--ds-neutral-12);
  font-size: var(--font-size-2);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

const Held = styled.p`
  margin: 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-2);
  font-style: italic;
`

const Meta = styled.span`
  overflow: hidden;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  white-space: nowrap;
  text-overflow: ellipsis;
`
