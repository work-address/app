import {
  OTHER_PROCESS_NAME,
  type ProjectProcessStats,
  type ProjectWithStats,
  type StatsPeriod,
} from '@/entities/projects'

export type Period = 'Week' | 'Month' | 'Year'

export const PERIOD_TO_STATS_PERIOD: Record<Period, StatsPeriod> = {
  Week: '7D',
  Month: '1M',
  Year: '1Y',
}

// Invisible bar: hover target for projects with no process data.
export const HIT_AREA_KEY = '__hit'

// Process names come from the tracker, so chart row keys are prefixed to avoid
// colliding with reserved fields like label or hasData.
const PROCESS_KEY_PREFIX = 'process:'

export type ProcessKey = `${typeof PROCESS_KEY_PREFIX}${string}`

export type ChartDatum = {
  label: string
  hasData: boolean
  failed: boolean
  [HIT_AREA_KEY]: number
} & Record<ProcessKey, number>

export type ApplicationsUsageChart = {
  data: ChartDatum[]
  processNames: string[]
  yAxis: { max: number; ticks: number[] }
}

export const toProcessKey = (processName: string): ProcessKey =>
  `${PROCESS_KEY_PREFIX}${processName}`

export const toProcessName = (key: string) =>
  key.slice(PROCESS_KEY_PREFIX.length)

export const isProcessKey = (key: string) => key.startsWith(PROCESS_KEY_PREFIX)

const BAR_COLORS = [
  'var(--c-rgba-0-52-130-0_75)',
  'var(--c-rgba-0-52-130-0_50)',
  'var(--c-rgba-0-52-130-0_28)',
  'var(--c-rgba-0-52-130-0_14)',
]

// Neutral color for the aggregated "Other" bucket so it reads as a tail, not another app.
const OTHER_BAR_COLOR = 'var(--c-rgba-0-7-20-0_22)'

// Palette size caps how many distinct processes get their own stacked segment.
const MAX_VISIBLE_PROCESSES = BAR_COLORS.length

export const getBarColor = (processName: string, index: number) =>
  processName === OTHER_PROCESS_NAME ? OTHER_BAR_COLOR : BAR_COLORS[index]

const Y_AXIS_TICK_COUNT = 6

// Integer hour ticks on the axis; fractional labels like "2.5H" clash with the tooltip format.
// Steps snap to 1/2/3/4/5 per decade so the axis reads 0-20-40-…-100, not 0-19-38-…-95.
const getYAxis = (maxHours: number) => {
  const rawStep = Math.max(1, maxHours / (Y_AXIS_TICK_COUNT - 1))
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step =
    [1, 2, 3, 4, 5, 10]
      .map((unit) => unit * magnitude)
      .find((candidate) => candidate >= rawStep) ?? Math.ceil(rawStep)

  return {
    max: step * (Y_AXIS_TICK_COUNT - 1),
    ticks: Array.from(
      { length: Y_AXIS_TICK_COUNT },
      (_, index) => index * step,
    ),
  }
}

export const buildApplicationsUsageChart = (
  projects: ProjectWithStats[],
  processStats: ProjectProcessStats[],
): ApplicationsUsageChart => {
  const statsByProject = new Map(
    processStats.map((stats) => [stats.projectId, stats]),
  )
  const totalsByProcess = new Map<string, number>()

  for (const stats of processStats) {
    for (const process of stats.processes) {
      if (process.timeMin <= 0) {
        continue
      }

      totalsByProcess.set(
        process.processName,
        (totalsByProcess.get(process.processName) ?? 0) + process.timeMin,
      )
    }
  }

  // Top processes by total time get their own series; the rest roll into "Other"
  // so stack colors stay distinguishable.
  const rankedProcessNames = [...totalsByProcess.entries()]
    .filter(([processName]) => processName !== OTHER_PROCESS_NAME)
    .sort(([, a], [, b]) => b - a)
    .map(([processName]) => processName)

  const visibleProcessNames = rankedProcessNames.slice(0, MAX_VISIBLE_PROCESSES)
  const hasOther =
    rankedProcessNames.length > visibleProcessNames.length ||
    totalsByProcess.has(OTHER_PROCESS_NAME)

  const processNames = hasOther
    ? [...visibleProcessNames, OTHER_PROCESS_NAME]
    : visibleProcessNames

  const isVisibleProcess = new Set(visibleProcessNames)
  let maxProjectHours = 0

  const data = projects.map((project) => {
    const stats = statsByProject.get(project.id ?? '')
    const row: ChartDatum = {
      label: project.title,
      hasData: false,
      failed: Boolean(stats?.failed),
      [HIT_AREA_KEY]: 0,
    }

    // Zero-fill every series so tooltip payload shape is stable across projects.
    for (const processName of processNames) {
      row[toProcessKey(processName)] = 0
    }

    let projectHours = 0

    for (const process of stats?.processes ?? []) {
      const hours = process.timeMin / 60

      if (hours <= 0) {
        continue
      }

      const processName = isVisibleProcess.has(process.processName)
        ? process.processName
        : OTHER_PROCESS_NAME

      row[toProcessKey(processName)] += hours
      row.hasData = true
      projectHours += hours
    }

    maxProjectHours = Math.max(maxProjectHours, projectHours)

    return row
  })

  return { data, processNames, yAxis: getYAxis(maxProjectHours) }
}
