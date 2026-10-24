import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time, TimeAgentRun } from '@/entities/time'

import { timeAgentRunsQuery } from '@/entities/time'
import { formatDurationFromMinutes, Text, Tooltip } from '@/shared'

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

const STATUSES = ['running', 'completed', 'cancelled', 'failed'] as const

type TimeDialogAgentsProps = {
  time: Time
}

/** The minutes of a run inside the entry's own period. */
const overlapMinutes = (run: TimeAgentRun, time: Time) => {
  const from = Math.max(Date.parse(run.fromAt), Date.parse(time.fromAt))
  const to = Math.min(Date.parse(run.toAt), Date.parse(time.toAt))

  return Math.max(0, to - from) / 60_000
}

/**
 * The runs that belong to an entry, with their minutes inside it, oldest
 * first. The previous entry's answer stays until this one's lands, so only
 * runs inside this period, by this entry's author, are kept.
 */
export const getEntryAgentRuns = (runs: TimeAgentRun[], time: Time) => {
  const authorId = (time as { user?: { id?: string } }).user?.id

  return runs
    .filter((run) => !authorId || run.userId === authorId)
    .map((run) => ({ run, minutes: overlapMinutes(run, time) }))
    .filter(({ minutes }) => minutes > 0)
    .sort((a, b) => Date.parse(a.run.fromAt) - Date.parse(b.run.fromAt))
}

/**
 * The agent runs of the entry's author on its project during its period.
 * Agent time is recorded apart from the person's activity, so it is listed
 * here, not counted in the entry's active minutes.
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
  const period = Date.parse(time.toAt) - Date.parse(time.fromAt)
  const formatDuration = (minutes: number) =>
    minutes < 1
      ? t('common.duration.underMinute')
      : formatDurationFromMinutes(Math.round(minutes), t)

  return (
    <Flex direction="column" gap="2" width="100%">
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.agents.title')}
      </Text>
      <List>
        {items.map(({ run, minutes }) => {
          const name = PRODUCT_NAMES[run.product] ?? run.product
          const status = (STATUSES as readonly string[]).includes(run.status)
            ? t(`dashboard.worklogsTable.agents.status.${run.status}`)
            : t('dashboard.worklogsTable.agents.status.unknown')
          const range = `${clock.format(new Date(run.fromAt))}–${clock.format(new Date(run.toAt))}`
          const duration = formatDuration(minutes)
          const percent =
            period > 0 ? Math.min(100, (minutes * 60_000 * 100) / period) : 0

          return (
            <Tooltip key={run.id} content={`${range} · ${status}`}>
              <Row
                aria-label={`${name}: ${duration}, ${range}, ${status}`}
                role="img"
              >
                <Fill style={{ width: `${Math.max(4, percent)}%` }} />
                <Name title={name}>{name}</Name>
                <Detail>{duration}</Detail>
              </Row>
            </Tooltip>
          )
        })}
      </List>
    </Flex>
  )
}

const List = styled.div`
  display: grid;
  gap: 3px;
  width: 100%;
`

// Drawn like the processes above: the share of the period sits behind the name.
const Row = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  border-radius: 4px;
  background: var(--c-rgba-0-0-51-0_04);
  overflow: hidden;
`

const Fill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--c-rgba-0-52-130-0_28);
`

const Name = styled.span`
  position: relative;
  overflow: hidden;
  padding: 0 var(--space-2);
  color: var(--ds-neutral-12);
  font-size: var(--font-size-1);
  line-height: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const Detail = styled.span`
  position: relative;
  padding: 0 var(--space-2);
  color: var(--ds-neutral-11);
  font-size: var(--font-size-0);
  line-height: 1;
  white-space: nowrap;
`
