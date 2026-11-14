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

import { $user } from '@/entities/profile'
import { $removedPromptRunKeys, recentAgentRunsQuery } from '@/entities/time'
import {
  AgentMark,
  AgentPromptRemoveButton,
  canRemoveAgentPrompt,
  PRODUCT_NAMES,
} from '@/features/time'
import { routes } from '@/routes'
import {
  formatCompactDurationFromMinutes,
  formatDurationFromMinutes,
  toDay,
} from '@/shared'

const VISIBLE_PROMPTS = 8

/**
 * The last prompts that started agent runs in the period. Another worker's
 * prompt stays held until their review window passes, and says so rather
 * than vanishing. Each opens the worklogs of its day and project.
 */
export const DashboardRecentPrompts = () => {
  const { t, i18n } = useTranslation()

  const { runs, removed, user, projects, userIds, pending, failed, retry } =
    useUnit({
      runs: recentAgentRunsQuery.$data,
      removed: $removedPromptRunKeys,
      user: $user,
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
      .filter((run) => !removed.has(run.runKey))
      .filter((run) => titles.has(run.projectId))
      .filter((run) => people.size === 0 || people.has(run.userId))
      .slice(0, VISIBLE_PROMPTS)
  }, [runs, removed, titles, userIds])

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
      <Root>
        {visible.map((run) => {
          const day = toDay(new Date(run.fromAt))
          const minutes =
            (Date.parse(run.toAt) - Date.parse(run.fromAt)) / 60_000
          const duration = Math.max(1, Math.round(minutes))
          const removable = canRemoveAgentPrompt(run, user?.id)

          return (
            <Row key={run.runKey}>
              <Item
                data-removable={removable || undefined}
                // The run itself, among that day's runs on its project.
                to={`${routes.agents.build()}?${new URLSearchParams({
                  from: day,
                  to: day,
                  project: run.projectId,
                  run: run.runKey,
                })}`}
              >
                <Icon aria-hidden="true">
                  <AgentMark product={run.product} size={20} />
                </Icon>
                <Body>
                  <Product>{PRODUCT_NAMES[run.product] ?? run.product}</Product>
                  <Duration aria-label={formatDurationFromMinutes(duration, t)}>
                    {formatCompactDurationFromMinutes(duration, i18n.language)}
                  </Duration>
                  {run.prompt ? (
                    <Prompt>{run.prompt}</Prompt>
                  ) : (
                    <Held>{t('dashboard.prompts.held')}</Held>
                  )}
                  <Meta>
                    <span>{titles.get(run.projectId)}</span>
                    <span>{when.format(new Date(run.fromAt))}</span>
                  </Meta>
                </Body>
              </Item>
              {/* Beside the link, not inside it: the row is an anchor, and a
                  button nested in one is invalid HTML. */}
              {removable && (
                <RemoveSlot>
                  <AgentPromptRemoveButton runKey={run.runKey} />
                </RemoveSlot>
              )}
            </Row>
          )
        })}
      </Root>
    </DashboardWidget>
  )
}

const Root = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Row = styled.li`
  position: relative;
  min-width: 0;

  & + & {
    border-top: var(--ui-border-width) solid var(--ui-line);
  }
`

/* A removable row reserves a separate target beside its worklog link. */
const Item = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-space-3);
  min-width: 0;
  padding: calc(var(--ui-space-4) + var(--ui-space-1)) var(--ui-space-2);
  border-radius: var(--ui-icon-radius);
  color: var(--ui-ink);
  text-decoration: none;
  transition: background-color var(--ui-transition);

  &[data-removable] {
    padding-right: var(--ui-space-7);
  }

  &:hover,
  &:focus-visible {
    background-color: var(--ui-inset);
    outline: none;
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 var(--ui-focus-width) var(--ui-blue);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Icon = styled.span`
  display: grid;
  place-items: center;
  width: var(--ui-space-7);
  height: var(--ui-space-7);
  border-radius: var(--ui-icon-radius);
`

const Body = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  column-gap: var(--ui-space-3);
  row-gap: var(--ui-space-1);
  min-width: 0;
`

const Product = styled.span`
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

const Duration = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Prompt = styled.p`
  display: -webkit-box;
  grid-column: 1 / -1;
  margin: 0;
  overflow: hidden;
  color: var(--ui-text);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-regular);
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;

  ${(p) => p.theme.breakpoints.down('md')} {
    -webkit-line-clamp: 3;
  }
`

const Held = styled.p`
  grid-column: 1 / -1;
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-style: italic;
`

/* Facts have variable intrinsic widths and should wrap as a sentence, so
   flex-wrap keeps their separators with each fact instead of equal grid cells. */
const Meta = styled.span`
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--ui-space-2);
  row-gap: var(--ui-space-1);
  min-width: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;

  & > * + *::before {
    content: '·';
    margin-right: var(--ui-space-2);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    display: grid;

    & > * + *::before {
      content: none;
    }
  }
`

const RemoveSlot = styled.div`
  position: absolute;
  top: calc(var(--ui-space-4) + var(--ui-space-1));
  right: var(--ui-space-2);
  display: grid;
`
