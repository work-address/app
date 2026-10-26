import { ChevronRightIcon } from '@radix-ui/react-icons'
import { Avatar } from '@radix-ui/themes'
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
 * One colour per agent product, picked by name so it is stable across loads.
 * Several products share an initial (claude-code, cursor, codex), so the
 * colour is what tells their marks apart. FNV-1a over ten hues keeps the
 * common products on different ones; a simple sum put most on two.
 */
const AVATAR_COLORS = [
  'indigo',
  'teal',
  'orange',
  'crimson',
  'violet',
  'grass',
  'cyan',
  'amber',
  'plum',
  'blue',
] as const

const avatarColor = (product: string) => {
  let hash = 0x81_1c_9d_c5

  for (let index = 0; index < product.length; index += 1) {
    hash = Math.imul(hash ^ product.charCodeAt(index), 0x01_00_01_93) >>> 0
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

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
                {/* The agent's mark: two letters in the product's colour, so
                    a column of prompts from several products reads at a
                    glance. */}
                <Avatar
                  size="2"
                  radius="full"
                  variant="soft"
                  color={avatarColor(run.product)}
                  fallback={run.product.slice(0, 2).toUpperCase()}
                  aria-hidden
                />
                <Body>
                  {run.prompt ? (
                    <Prompt>{run.prompt}</Prompt>
                  ) : (
                    <Held>{t('dashboard.prompts.held')}</Held>
                  )}
                  <Meta>
                    <Product>{run.product}</Product>
                    <span>{titles.get(run.projectId)}</span>
                    <span>
                      {formatDurationFromMinutes(
                        Math.max(1, Math.round(minutes)),
                        t,
                      )}
                    </span>
                    <span>{when.format(new Date(run.fromAt))}</span>
                  </Meta>
                </Body>
                <Chevron aria-hidden="true" />
              </Item>
            </li>
          )
        })}
      </List>
    </DashboardWidget>
  )
}

/* Reaches into the card's padding, so a row's hover tint runs edge to edge. */
const List = styled.ul`
  display: grid;
  margin: calc(var(--space-2) * -1) calc(var(--space-4) * -1);
  padding: 0;
  list-style: none;

  li + li {
    border-top: 1px solid var(--ds-neutral-alpha-4);
  }
`

/* The whole row is the link: a tint says so on hover, and the chevron says
   where it goes. */
const Item = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: inherit;
  text-decoration: none;
  transition: background-color 0.15s ease;

  &:hover,
  &:focus-visible {
    background-color: var(--ds-neutral-2);
    outline: none;
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--ds-accent-9);
  }
`

const Body = styled.span`
  display: grid;
  gap: var(--space-1);
  min-width: 0;
`

const Prompt = styled.p`
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--ds-neutral-12);
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  font-weight: 500;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

const Held = styled.p`
  margin: 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  font-style: italic;
`

/* Facts parted by dots, the product first and darker: it is the answer to
   "which agent", the rest is where and when. */
const Meta = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--space-2);
  row-gap: 0;
  min-width: 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);

  & > * + *::before {
    content: '·';
    margin-right: var(--space-2);
  }
`

const Product = styled.span`
  color: var(--ds-neutral-12);
  font-weight: 500;
`

const Chevron = styled(ChevronRightIcon)`
  color: var(--ds-neutral-11);
  transition: transform 0.15s ease;

  ${Item}:hover & {
    transform: translateX(2px);
  }
`
