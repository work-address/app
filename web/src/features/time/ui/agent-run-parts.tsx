import { Badge } from '@radix-ui/themes'
import {
  AGENT_SUPPORT,
  type AgentSupportStatus,
} from '@work-address/agent-tracking-contract/support'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { TimeAgentRun, TimeAgentSegment } from '@/entities/time'

import { formatDurationFromMinutes } from '@/shared'

/*
 * What every view of an agent run draws it with: the names collectors report
 * by, its status colours, and its timeline. The time dialog and the Agents
 * page show runs alike.
 */

// The names the desktop tracker and server collectors report products by.
export const PRODUCT_NAMES: Record<string, string> = {
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
  hermes: 'Hermes Agent',
  opencode: 'OpenCode',
  // The shared support list names the agents it records.
  ...Object.fromEntries(
    AGENT_SUPPORT.map((agent) => [agent.product, agent.name]),
  ),
}

/** Where a run was recorded: a server's collector or the desktop app. */
export type AgentRunPlace = 'fixed' | 'timer'

const supportOf = (product: string) =>
  AGENT_SUPPORT.find((agent) => agent.product === product)

/** How far recording this agent in this place is supported; null if it is not listed. */
export const agentSupportStatus = (
  product: string,
  place: AgentRunPlace,
): AgentSupportStatus | null => {
  const agent = supportOf(product)

  if (!agent) {
    return null
  }

  return place === 'fixed' ? agent.servers.status : agent.computer.status
}

/** The agent's collector never sends a prompt from servers, so none is missing. */
export const agentSendsNoPrompt = (
  product: string,
  place: AgentRunPlace,
): boolean => place === 'fixed' && supportOf(product)?.servers.prompts === false

/**
 * "Available" or "Experimental" for an agent in one place, with its known
 * limits on hover. Nothing for an agent the list does not record there.
 */
export const AgentSupportBadge = ({
  product,
  place,
}: {
  product: string
  place: AgentRunPlace
}) => {
  const { t } = useTranslation()
  const status = agentSupportStatus(product, place)

  if (!status || status === 'none') {
    return null
  }

  const agent = supportOf(product)
  const name = agent?.name ?? product
  const limits =
    place === 'fixed'
      ? (agent?.servers.limits ?? []).map((limit) =>
          t(`agents.support.limit.${limit}`, {
            product: name,
            versions: agent?.servers.versions.join(', '),
          }),
        )
      : []
  const title = [
    status === 'experimental'
      ? t('agents.support.experimentalHint', { product: name })
      : null,
    ...limits,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Badge
      color={status === 'available' ? 'green' : 'amber'}
      variant="soft"
      size="1"
      title={title || undefined}
    >
      {t(`agents.support.${status}`)}
    </Badge>
  )
}

// Two letters each, so the agents tell apart without their makers' logos.
const AGENT_MARKS: Record<string, { text: string; color: string }> = {
  'claude-code': { text: 'CC', color: 'var(--orange-9)' },
  codex: { text: 'Cx', color: 'var(--gray-12)' },
  openclaw: { text: 'OC', color: 'var(--red-9)' },
  hermes: { text: 'HA', color: 'var(--violet-9)' },
  'kimi-code': { text: 'KC', color: 'var(--blue-9)' },
}

/** A small square mark for an agent; others get the first letters of their name. */
export const AgentMark = ({
  product,
  size = 16,
}: {
  product: string
  size?: number
}) => {
  const mark = AGENT_MARKS[product] ?? {
    text: (PRODUCT_NAMES[product] ?? product).slice(0, 2),
    color: 'var(--gray-9)',
  }

  return (
    <Mark
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        background: mark.color,
      }}
    >
      {mark.text}
    </Mark>
  )
}

const Mark = styled.span`
  display: inline-grid;
  flex: none;
  place-items: center;
  border-radius: 4px;
  color: var(--gray-1);
  font-weight: var(--ui-weight-medium);
  line-height: 1;
  letter-spacing: -0.02em;
`

export const SURFACE_NAMES: Record<string, string> = {
  cli: 'CLI',
  ide: 'IDE',
  desktop: 'Desktop',
  web: 'Web',
  cloud: 'Cloud',
}

export const STATUS_COLORS = {
  running: 'blue',
  completed: 'green',
  cancelled: 'gray',
  failed: 'red',
} as const

export type AgentRunStatus = keyof typeof STATUS_COLORS

/** A status the badges know, else none: drawn as unfinished. */
export const agentRunStatus = (status: string): AgentRunStatus | null =>
  status in STATUS_COLORS ? (status as AgentRunStatus) : null

export type SegmentState = TimeAgentSegment['state']

// Legend and timeline order: what bills first, the paused timer last.
export const STATES: SegmentState[] = [
  'running',
  'human_wait',
  'unknown',
  'untracked',
]

export const STATE_COLORS: Record<SegmentState, string> = {
  running: 'var(--ui-blue)',
  human_wait: 'var(--amber-9)',
  unknown: 'var(--ui-muted)',
  untracked: 'var(--ui-line)',
}

export type AgentRunSummary = {
  run: TimeAgentRun
  /** Billable minutes inside the period: every state but `untracked`. */
  minutes: number
  minutesByState: Record<SegmentState, number>
  /** The run's segments clipped to the period, as shares of it. */
  spans: { state: SegmentState; left: number; width: number }[]
}

/**
 * A run's timeline clipped to a period: an entry's, or the run's own. A run
 * without segments is one unclassified span, which is what the server bills
 * it as.
 */
export const summarizeAgentRun = (
  run: TimeAgentRun,
  from = Date.parse(run.fromAt),
  to = Date.parse(run.toAt),
): AgentRunSummary => {
  const period = Math.max(to - from, 1)
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
  const spans: AgentRunSummary['spans'] = []

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

/** Minutes as the runs say them: under a minute is said so, not as zero. */
export const useAgentMinutes = () => {
  const { t } = useTranslation()

  return (minutes: number) =>
    minutes > 0 && minutes < 1
      ? t('common.duration.underMinute')
      : formatDurationFromMinutes(Math.round(minutes), t)
}

/** The run's states along its period, and the minutes in each below. */
export const AgentRunTimeline = ({
  summary,
}: {
  summary: Pick<AgentRunSummary, 'minutesByState' | 'spans'>
}) => {
  const { t } = useTranslation()
  const formatMinutes = useAgentMinutes()
  const { minutesByState, spans } = summary
  const legend = STATES.filter((state) => minutesByState[state] > 0)
  const stateLabel = (state: SegmentState) =>
    t(`dashboard.worklogsTable.agents.state.${state}`)

  return (
    <>
      <Timeline
        role="img"
        aria-label={legend
          .map(
            (state) =>
              `${stateLabel(state)} ${formatMinutes(minutesByState[state])}`,
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
            <LegendValue>{formatMinutes(minutesByState[state])}</LegendValue>
          </LegendItem>
        ))}
      </Legend>
    </>
  )
}

// The whole period; each span sits where the run was in it.
const Timeline = styled.div`
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: var(--ui-inset);
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
      var(--ui-line) 2px 4px
    ) !important;
  }
`

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1) var(--ui-space-3);
`

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`

const LegendValue = styled.span`
  color: var(--ui-ink);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`

export const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
`
