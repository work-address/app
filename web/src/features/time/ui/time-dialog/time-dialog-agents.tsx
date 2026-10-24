import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time, TimeAgentRun, TimeAgentSegment } from '@/entities/time'

import { timeAgentRunsQuery } from '@/entities/time'
import { formatDurationFromMinutes, Text } from '@/shared'

// The names the desktop tracker and server collectors report products by.
const PRODUCT_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  'gemini-cli': 'Gemini CLI',
  copilot: 'Copilot',
  windsurf: 'Windsurf',
  cline: 'Cline',
  minimax: 'MiniMax',
  'devin-local': 'Devin Local',
  'claude-cowork': 'Claude Cowork',
  'kimi-code': 'Kimi Code',
  'kimi-cli': 'Kimi CLI',
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
  opencode: 'OpenCode',
}

const SURFACE_NAMES: Record<string, string> = {
  cli: 'CLI',
  ide: 'IDE',
  desktop: 'Desktop',
  web: 'Web',
  cloud: 'Cloud',
}

const STATUS_COLORS = {
  running: 'blue',
  completed: 'green',
  cancelled: 'gray',
  failed: 'red',
} as const

type SegmentState = TimeAgentSegment['state']

// Legend and timeline order: what bills first, the paused timer last.
const STATES: SegmentState[] = ['running', 'human_wait', 'unknown', 'untracked']

const STATE_COLORS: Record<SegmentState, string> = {
  running: 'var(--ds-accent-9)',
  human_wait: 'var(--amber-9)',
  unknown: 'var(--gray-8)',
  untracked: 'var(--gray-a5)',
}

type TimeDialogAgentsProps = {
  time: Time
}

export type EntryAgentRun = {
  run: TimeAgentRun
  /** Billable minutes inside the entry: every state but `untracked`. */
  minutes: number
  minutesByState: Record<SegmentState, number>
  /** The run's segments clipped to the entry, as shares of its period. */
  spans: { state: SegmentState; left: number; width: number }[]
}

/**
 * A run's timeline clipped to the entry. A run without segments is one
 * unclassified span, which is what the server bills it as.
 */
const summarize = (
  run: TimeAgentRun,
  from: number,
  to: number,
): EntryAgentRun => {
  const period = to - from
  const segments: Pick<TimeAgentSegment, 'fromAt' | 'toAt' | 'state'>[] = run
    .segments?.length
    ? run.segments
    : [{ fromAt: run.fromAt, toAt: run.toAt, state: 'unknown' }]
  const minutesByState: Record<SegmentState, number> = {
    running: 0,
    human_wait: 0,
    unknown: 0,
    untracked: 0,
  }
  const spans: EntryAgentRun['spans'] = []

  for (const segment of segments) {
    const start = Math.max(Date.parse(segment.fromAt), from)
    const end = Math.min(Date.parse(segment.toAt), to)
    if (end <= start) {
      continue
    }
    minutesByState[segment.state] += (end - start) / 60_000
    spans.push({
      state: segment.state,
      left: ((start - from) / period) * 100,
      width: ((end - start) / period) * 100,
    })
  }

  return {
    run,
    minutes:
      minutesByState.running +
      minutesByState.human_wait +
      minutesByState.unknown,
    minutesByState,
    spans,
  }
}

/**
 * The runs that belong to an entry, summarized inside its period, oldest
 * first. The previous entry's answer stays until this one's lands, so only
 * runs inside this period, by this entry's author, are kept.
 */
export const getEntryAgentRuns = (
  runs: TimeAgentRun[],
  time: Time,
): EntryAgentRun[] => {
  const authorId = (time as { user?: { id?: string } }).user?.id
  const from = Date.parse(time.fromAt)
  const to = Date.parse(time.toAt)
  if (to <= from) {
    return []
  }

  return runs
    .filter((run) => !authorId || run.userId === authorId)
    .map((run) => summarize(run, from, to))
    .filter(({ spans }) => spans.length > 0)
    .sort((a, b) => Date.parse(a.run.fromAt) - Date.parse(b.run.fromAt))
}

/**
 * The agent runs of the entry's author on its project during its period.
 * Agent time is recorded apart from the person's activity, so it is listed
 * here, not counted in the entry's active minutes. Everything is on the card:
 * nothing waits behind a hover, which a touch screen does not have.
 */
export const TimeDialogAgents = ({ time }: TimeDialogAgentsProps) => {
  const { t, i18n } = useTranslation()
  const { start, runs } = useUnit({
    start: timeAgentRunsQuery.start,
    runs: timeAgentRunsQuery.$data,
  })

  const projectId = time.project?.id

  useEffect(() => {
    if (projectId && time.project?.trackAgents !== false) {
      start({ projectId, fromAt: time.fromAt, toAt: time.toAt })
    }
  }, [start, projectId, time.fromAt, time.toAt, time.project?.trackAgents])

  const items = getEntryAgentRuns(runs ?? [], time)

  if (items.length === 0) {
    return null
  }

  const clock = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const formatDuration = (minutes: number) =>
    minutes > 0 && minutes < 1
      ? t('common.duration.underMinute')
      : formatDurationFromMinutes(Math.round(minutes), t)
  const stateLabel = (state: SegmentState) =>
    t(`dashboard.worklogsTable.agents.state.${state}`)

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
          const statusKey =
            run.status in STATUS_COLORS
              ? (run.status as keyof typeof STATUS_COLORS)
              : null
          const range = `${clock.format(new Date(run.fromAt))}–${clock.format(new Date(run.toAt))}`
          const legend = STATES.filter((state) => minutesByState[state] > 0)

          return (
            <Card key={run.id}>
              <Flex align="center" gap="2" minWidth="0">
                <Avatar aria-hidden>{name.slice(0, 1)}</Avatar>
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
              {run.prompt && (
                <RunPrompt
                  label={t('dashboard.worklogsTable.agents.prompt')}
                  text={run.prompt}
                />
              )}
              <Timeline
                role="img"
                aria-label={legend
                  .map(
                    (state) =>
                      `${stateLabel(state)} ${formatDuration(minutesByState[state])}`,
                  )
                  .join(', ')}
              >
                {spans.map((span, index) => (
                  <Span
                    key={index}
                    data-state={span.state}
                    style={{
                      left: `${span.left}%`,
                      width: `${span.width}%`,
                      background: STATE_COLORS[span.state],
                    }}
                  />
                ))}
              </Timeline>
              <Legend>
                {legend.map((state) => (
                  <LegendItem key={state}>
                    <Dot style={{ background: STATE_COLORS[state] }} />
                    {stateLabel(state)}
                    <LegendValue>
                      {formatDuration(minutesByState[state])}
                    </LegendValue>
                  </LegendItem>
                ))}
              </Legend>
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

const List = styled.div`
  display: grid;
  gap: var(--space-2);
  width: 100%;
`

const Card = styled.div`
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--gray-a5);
  border-radius: var(--radius-3);
  background: var(--color-surface);
`

const Avatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-2);
  background: var(--ds-accent-3);
  color: var(--ds-accent-11);
  font-size: var(--font-size-2);
  font-weight: 600;
`

const Prompt = styled.button`
  all: unset;
  display: block;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--gray-a2);
  color: var(--ds-neutral-12);
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);
  cursor: pointer;

  &[data-open] {
    max-height: 240px;
    overflow-y: auto;
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-8);
    outline-offset: 1px;
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

// The entry's whole period; each span sits where the run was in it.
const Timeline = styled.div`
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: var(--gray-a3);
  overflow: hidden;
`

const Span = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 2px;

  /* A paused timer is a gap in the billing, drawn as one. */
  &[data-state='untracked'] {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent 0 2px,
      var(--gray-a6) 2px 4px
    ) !important;
  }
`

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
`

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);
`

const LegendValue = styled.span`
  color: var(--ds-neutral-12);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
`
