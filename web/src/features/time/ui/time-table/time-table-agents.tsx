import { useUnit } from 'effector-react'
import { createContext, useContext, useEffect, useMemo } from 'react'
import styled from 'styled-components'

import { PRODUCT_NAMES } from '../agent-run-parts'
import { TimeContext } from '../time-context'
import { getEntryAgentRuns } from '../time-dialog/time-dialog-agents'

import {
  tableAgentRunsQuery,
  type Time,
  type TimeAgentRun,
} from '@/entities/time'
import { formatDurationFromMinutes } from '@/shared'

/** What a row of the time list says of the agent runs inside its entry. */
export type TableAgentSummary = {
  /** The newest run that overlaps the entry: its prompt leads. */
  latest: TimeAgentRun
  /** Minutes in the `running` state inside the entry, across its runs. */
  runningMinutes: number
  /** Billable minutes inside the entry: every state but `untracked`. */
  minutes: number
  count: number
}

/**
 * Each entry's runs, matched as the dialog matches them: by its author, on its
 * project, inside its period. Entries with none are left out.
 */
export const getTableAgentSummaries = (
  runs: TimeAgentRun[],
  entries: Time[],
): Map<string, TableAgentSummary> => {
  const summaries = new Map<string, TableAgentSummary>()
  if (runs.length === 0) {
    return summaries
  }

  // Grouped first, so each entry looks only at its own project's runs.
  const byProject = new Map<string, TimeAgentRun[]>()
  for (const run of runs) {
    const list = byProject.get(run.projectId) ?? []
    list.push(run)
    byProject.set(run.projectId, list)
  }

  for (const entry of entries) {
    const projectRuns = entry.project?.id
      ? byProject.get(entry.project.id)
      : undefined
    if (!entry.id || !projectRuns) {
      continue
    }
    const items = getEntryAgentRuns(projectRuns, entry)
    const latest = items.at(-1)
    if (!latest) {
      continue
    }
    summaries.set(entry.id, {
      latest: latest.run,
      runningMinutes: items.reduce(
        (sum, item) => sum + item.minutesByState.running,
        0,
      ),
      minutes: items.reduce((sum, item) => sum + item.minutes, 0),
      count: items.length,
    })
  }

  return summaries
}

/** The loaded entries' span: the one range the list asks the runs of. */
export const getTableAgentRange = (
  entries: Time[],
): { fromAt: string; toAt: string } | null => {
  let from = Infinity
  let to = -Infinity
  for (const entry of entries) {
    if (entry.project?.trackAgents === false) {
      continue
    }
    from = Math.min(from, Date.parse(entry.fromAt))
    to = Math.max(to, Date.parse(entry.toAt))
  }
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null
  }

  return {
    fromAt: new Date(from).toISOString(),
    toAt: new Date(to).toISOString(),
  }
}

/**
 * Asks once for every run across the loaded entries and matches them to the
 * rows. The range grows as more entries load, and the answer with it; nothing
 * is asked while no loaded entry's project tracks agents.
 */
export const useTableAgentSummaries = (
  entries: Time[],
): Map<string, TableAgentSummary> => {
  const { start, runs } = useUnit({
    start: tableAgentRunsQuery.start,
    runs: tableAgentRunsQuery.$data,
  })

  const range = getTableAgentRange(entries)
  const fromAt = range?.fromAt
  const toAt = range?.toAt

  useEffect(() => {
    if (fromAt && toAt) {
      start({ fromAt, toAt })
    }
  }, [start, fromAt, toAt])

  return useMemo(
    () => getTableAgentSummaries(range ? (runs ?? []) : [], entries),
    // range is derived from entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, entries, fromAt, toAt],
  )
}

/** The rows' summaries, for the cells, which see only their own entry. */
export const TableAgentsContext = createContext<Map<string, TableAgentSummary>>(
  new Map(),
)

/**
 * One line of prompt and one of minutes. The prompt is cut to a line; the
 * dialog the row opens has the whole of it.
 */
export const TimeTableAgents = ({
  entry,
  hideEmpty = false,
}: {
  entry: Time
  /** The phone list leaves an entry with no runs as it was. */
  hideEmpty?: boolean
}) => {
  const { t } = useContext(TimeContext)
  const summaries = useContext(TableAgentsContext)
  const summary = entry.id ? summaries.get(entry.id) : undefined

  if (!summary) {
    return hideEmpty ? null : <Meta>—</Meta>
  }

  const { latest, runningMinutes, minutes, count } = summary
  const product = PRODUCT_NAMES[latest.product] ?? latest.product
  const lead = latest.prompt
    ? latest.prompt
    : latest.promptPendingReview
      ? t('time.list.agents.held')
      : product
  const formatMinutes = (value: number) =>
    value > 0 && value < 1
      ? t('common.duration.underMinute')
      : formatDurationFromMinutes(Math.round(value), t)
  // A run with no timeline is unclassified throughout: its minutes are said as billable.
  const figure =
    runningMinutes > 0
      ? t('time.list.agents.running', {
          duration: formatMinutes(runningMinutes),
        })
      : t('dashboard.worklogsTable.agents.billable', {
          duration: formatMinutes(minutes),
        })

  return (
    <Stack>
      <Prompt
        title={latest.prompt ?? undefined}
        data-held={!latest.prompt || undefined}
      >
        {lead}
      </Prompt>
      <Meta>
        {figure}
        {count > 1
          ? ` · ${t('time.list.agents.more', { count: count - 1 })}`
          : null}
      </Meta>
    </Stack>
  )
}

const Stack = styled.span`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Prompt = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);

  &[data-held] {
    color: var(--ui-muted);
  }
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`
