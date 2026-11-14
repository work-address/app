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
  hermes: 'Hermes',
  opencode: 'OpenCode',
}

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
