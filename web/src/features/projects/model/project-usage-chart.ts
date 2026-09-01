import {
  OTHER_PROCESS_NAME,
  type ProjectProcessStats,
  type StatsPeriod,
} from '@/entities/projects'
import { getHourAxis, type HourAxis } from '@/shared'

export type UsagePeriod = 'Week' | 'Month' | 'Year'

export const USAGE_PERIOD_TO_STATS_PERIOD: Record<UsagePeriod, StatsPeriod> = {
  Week: '7D',
  Month: '1M',
  Year: '1Y',
}

export type ProjectUsageDatum = {
  processName: string
  hours: number
}

export type ProjectUsageChart = {
  data: ProjectUsageDatum[]
  yAxis: HourAxis
}

// The dashboard chart stacks apps inside one bar per project, so it can only
// afford a handful of distinguishable colors. Here every app owns a bar and is
// named on the axis, so the list is capped by legibility rather than palette.
const MAX_VISIBLE_PROCESSES = 8

export const buildProjectUsageChart = (
  stats?: ProjectProcessStats | null,
): ProjectUsageChart => {
  const byProcess = new Map<string, number>()

  for (const process of stats?.processes ?? []) {
    if (process.timeMin <= 0) {
      continue
    }

    byProcess.set(
      process.processName,
      (byProcess.get(process.processName) ?? 0) + process.timeMin / 60,
    )
  }

  const ranked = [...byProcess.entries()]
    .filter(([processName]) => processName !== OTHER_PROCESS_NAME)
    .sort(([, a], [, b]) => b - a)

  // Everything past the cap joins whatever the tracker already bucketed as
  // "Other", so the tail stays visible as one bar instead of dropping out.
  const visible = ranked.slice(0, MAX_VISIBLE_PROCESSES)
  const otherHours =
    (byProcess.get(OTHER_PROCESS_NAME) ?? 0) +
    ranked
      .slice(MAX_VISIBLE_PROCESSES)
      .reduce((acc, [, hours]) => acc + hours, 0)

  const data: ProjectUsageDatum[] = visible.map(([processName, hours]) => ({
    processName,
    hours,
  }))

  if (otherHours > 0) {
    data.push({ processName: OTHER_PROCESS_NAME, hours: otherHours })
  }

  const maxHours = data.reduce((acc, datum) => Math.max(acc, datum.hours), 0)

  return { data, yAxis: getHourAxis(maxHours) }
}
