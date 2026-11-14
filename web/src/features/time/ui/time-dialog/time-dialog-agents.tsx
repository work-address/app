import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { canRemoveAgentPrompt } from '../../model/agent-prompt.model'
import { AgentPromptRemoveButton } from '../agent-prompt-remove-button'
import {
  AgentMark,
  agentRunStatus,
  AgentRunTimeline,
  type AgentRunSummary,
  PRODUCT_NAMES,
  STATUS_COLORS,
  summarizeAgentRun,
  SURFACE_NAMES,
  useAgentMinutes,
} from '../agent-run-parts'

import type { Time, TimeAgentRun } from '@/entities/time'

import { $removedPromptRunKeys, timeAgentRunsQuery } from '@/entities/time'
import { routes } from '@/routes'
import { Text, toDay } from '@/shared'

type TimeDialogAgentsProps = {
  items: EntryAgentRun[]
  /** The reader, who may remove the prompts of their own runs. */
  userId?: string
}

export type EntryAgentRun = AgentRunSummary

/**
 * The runs that belong to an entry, by its author on its project,
 * summarized inside its period, oldest first. The previous entry's answer stays until this one's lands, so only
 * runs inside this period, by this entry's author, are kept.
 */
export const getEntryAgentRuns = (
  runs: TimeAgentRun[],
  time: Time,
): EntryAgentRun[] => {
  const authorId = time.user?.id
  const projectId = time.project?.id
  const from = Date.parse(time.fromAt)
  const to = Date.parse(time.toAt)
  if (to <= from) {
    return []
  }

  return runs
    .filter((run) => !authorId || run.userId === authorId)
    .filter((run) => !projectId || run.projectId === projectId)
    .map((run) => summarizeAgentRun(run, from, to))
    .filter(({ spans }) => spans.length > 0)
    .sort((a, b) => Date.parse(a.run.fromAt) - Date.parse(b.run.fromAt))
}

/**
 * Asks for the agent runs of the entry's author on its project during its
 * period and summarizes them. The dialog calls it, so it can make room for
 * them only when there are some.
 */
export const useEntryAgentRuns = (time: Time | null): EntryAgentRun[] => {
  const { start, runs } = useUnit({
    start: timeAgentRunsQuery.start,
    runs: timeAgentRunsQuery.$data,
  })

  const projectId = time?.project?.id
  const tracksAgents = time?.project?.trackAgents !== false
  const fromAt = time?.fromAt
  const toAt = time?.toAt

  useEffect(() => {
    if (projectId && tracksAgents && fromAt && toAt) {
      start({ projectId, fromAt, toAt })
    }
  }, [start, projectId, tracksAgents, fromAt, toAt])

  return time ? getEntryAgentRuns(runs ?? [], time) : []
}

/**
 * An entry's agent runs. Agent time is recorded apart from the person's
 * activity, so it is listed here, not counted in the entry's active minutes.
 * Everything is on the card: nothing waits behind a hover, which a touch
 * screen does not have.
 */
export const TimeDialogAgents = ({ items, userId }: TimeDialogAgentsProps) => {
  const { t, i18n } = useTranslation()
  const removed = useUnit($removedPromptRunKeys)
  const formatDuration = useAgentMinutes()

  if (items.length === 0) {
    return null
  }

  const clock = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <Flex direction="column" gap="2" width="100%">
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.agents.title')}
      </Text>
      <List>
        {items.map(({ run, minutes, minutesByState, spans }) => {
          const name = PRODUCT_NAMES[run.product] ?? run.product
          const surface = run.surface
            ? (SURFACE_NAMES[run.surface] ?? run.surface)
            : null
          const statusKey = agentRunStatus(run.status)
          const range = `${clock.format(new Date(run.fromAt))}–${clock.format(new Date(run.toAt))}`

          return (
            <Card key={run.runKey}>
              <Flex align="center" gap="2" minWidth="0">
                <AgentMark product={run.product} size={24} />
                <Flex direction="column" minWidth="0" flexGrow="1">
                  <Text size="2" weight="medium" truncate>
                    {name}
                    {surface && (
                      <Text color="gray" weight="regular" ml="1">
                        · {surface}
                      </Text>
                    )}
                  </Text>
                  <Text size="1" color="gray">
                    {range}
                  </Text>
                </Flex>
                <Flex direction="column" align="end" gap="1" flexShrink="0">
                  <Flex gap="1">
                    {run.isPaid ? (
                      <Badge color="green" variant="soft" size="1">
                        {t('dashboard.worklogsTable.paymentStatus.paid')}
                      </Badge>
                    ) : run.invoiceId ? (
                      <Badge color="gray" variant="soft" size="1">
                        {t('dashboard.worklogsTable.agents.invoiced')}
                      </Badge>
                    ) : null}
                    <Badge
                      color={statusKey ? STATUS_COLORS[statusKey] : 'amber'}
                      variant="soft"
                      size="1"
                    >
                      {t(
                        `dashboard.worklogsTable.agents.status.${statusKey ?? 'unknown'}`,
                      )}
                    </Badge>
                  </Flex>
                  <Text size="1" weight="medium">
                    {t('dashboard.worklogsTable.agents.billable', {
                      duration: formatDuration(minutes),
                    })}
                  </Text>
                </Flex>
              </Flex>
              {run.prompt && !removed.has(run.runKey) && (
                <PromptRow>
                  <RunPrompt
                    label={t('dashboard.worklogsTable.agents.prompt')}
                    text={run.prompt}
                  />
                  {canRemoveAgentPrompt(run, userId) && (
                    <AgentPromptRemoveButton runKey={run.runKey} />
                  )}
                </PromptRow>
              )}
              <AgentRunTimeline summary={{ minutesByState, spans }} />
              <RunLink
                to={`${routes.agents.build()}?${new URLSearchParams({
                  from: toDay(new Date(run.fromAt)),
                  to: toDay(new Date(run.fromAt)),
                  project: run.projectId,
                  run: run.runKey,
                })}`}
              >
                {t('time.dialog.agents.openRun')}
              </RunLink>
            </Card>
          )
        })}
      </List>
    </Flex>
  )
}

/** Two lines of the prompt; a click shows all of it, as typed. */
const RunPrompt = ({ label, text }: { label: string; text: string }) => {
  const [open, setOpen] = useState(false)

  return (
    <Prompt
      type="button"
      aria-label={label}
      aria-expanded={open}
      title={open ? undefined : text}
      data-open={open || undefined}
      onClick={() => setOpen((value) => !value)}
    >
      <PromptText>{text}</PromptText>
    </Prompt>
  )
}

// Scrolls on its own and never runs past the window, however many runs
// fall inside the entry: 240px leaves room for the overlay's margins, the
// dialog's padding and header, and this section's title.
const List = styled.div`
  display: grid;
  align-content: start;
  gap: var(--ui-space-2);
  width: 100%;
  max-height: calc(100dvh - 240px);
  overflow-y: auto;
  overscroll-behavior: contain;
`

const Card = styled.div`
  display: grid;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-line);
  border-radius: var(--ui-filter-radius);
  background: var(--ui-surface);
`

const PromptRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--ui-space-2);
`

const Prompt = styled.button`
  all: unset;
  display: block;
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-row-radius);
  background: var(--ui-inset);
  color: var(--ui-ink);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  cursor: pointer;

  &[data-open] {
    max-height: 240px;
    overflow-y: auto;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`

// The clamp sits inside the padding, so a third line never shows through it.
const PromptText = styled.span`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  [data-open] > & {
    display: block;
  }
`

// Everything else about the run is on the Agents page.
const RunLink = styled(Link)`
  justify-self: start;
  color: var(--ui-blue);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`
