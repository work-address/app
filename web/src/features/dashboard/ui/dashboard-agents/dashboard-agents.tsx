import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { bucketBreakdowns } from '../../model/bucket-breakdown'
import {
  $dashboardRange,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'
import {
  bucketKeyOf,
  bucketLabels,
  periodBuckets,
  visibleBuckets,
} from '../../model/period-buckets'
import { DashboardWidget } from '../dashboard-widget'

import { $projects } from '@/entities/projects'
import {
  statisticsAgentsQuery,
  statisticsDailyQuery,
} from '@/entities/statistics'
import {
  BucketBarChart,
  formatDurationFromMinutes,
  SERIES_COLORS,
  weekStartsOnFor,
  type Bucket,
  type ChartTooltipContent,
} from '@/shared'

/** How many agents or projects a popup column names. */
const POPUP_ROWS = 6

const HUMAN = 'human'
const AGENT = 'agent'

/* Short enough that figures, chart and a few agents fit the tile's ceiling. */
const CHART_HEIGHT = 150

// agent | runs | assisted | autonomous
const COLUMN_WIDTHS = ['40%', '15%', '22.5%', '22.5%']

type ProductRow = {
  product: string
  assisted: number
  autonomous: number
  waiting: number
  runs: number
}

/**
 * What agents did in the period: how much ran alongside a person's own timer
 * (assisted) and how much without (autonomous), next to the human hours, and
 * which products did it. Waiting on a person is shown apart and never counts
 * as agent time.
 */
export const DashboardAgents = () => {
  const { t, i18n } = useTranslation()

  const { range, agents, daily, projects, pending, failed, retry } = useUnit({
    range: $dashboardRange,
    agents: statisticsAgentsQuery.$data,
    daily: statisticsDailyQuery.$data,
    projects: $projects,
    pending: statisticsAgentsQuery.$pending,
    failed: statisticsAgentsQuery.$failed,
    retry: dashboardStatisticsRequested,
  })

  const view = useMemo(() => {
    const weekStartsOn = weekStartsOnFor(i18n.language)
    const periods = periodBuckets(range, weekStartsOn)
    const size = periods[0]?.size ?? 'day'
    const values = new Map<string, Record<string, number>>()
    const add = (day: string, key: string, hours: number) => {
      const bucketKey = bucketKeyOf(day, size, weekStartsOn)
      const bucket = values.get(bucketKey) ?? {}

      bucket[key] = (bucket[key] ?? 0) + hours
      values.set(bucketKey, bucket)
    }

    for (const row of daily ?? []) {
      add(row.day, HUMAN, row.trackedSeconds / 3600)
    }

    const products = new Map<string, ProductRow>()
    const totals = { assisted: 0, autonomous: 0, waiting: 0 }

    for (const row of agents?.daily ?? []) {
      add(row.day, AGENT, (row.assistedSeconds + row.autonomousSeconds) / 3600)

      const product = products.get(row.product) ?? {
        product: row.product,
        assisted: 0,
        autonomous: 0,
        waiting: 0,
        runs: 0,
      }

      product.assisted += row.assistedSeconds / 60
      product.autonomous += row.autonomousSeconds / 60
      product.waiting += row.waitSeconds / 60
      products.set(row.product, product)
      totals.assisted += row.assistedSeconds / 60
      totals.autonomous += row.autonomousSeconds / 60
      totals.waiting += row.waitSeconds / 60
    }

    const statuses = new Map<string, number>()
    let runs = 0

    for (const row of agents?.runs ?? []) {
      runs += row.count
      statuses.set(row.status, (statuses.get(row.status) ?? 0) + row.count)

      const product = products.get(row.product) ?? {
        product: row.product,
        assisted: 0,
        autonomous: 0,
        waiting: 0,
        runs: 0,
      }

      product.runs += row.count
      products.set(row.product, product)
    }

    const buckets: Bucket[] = visibleBuckets(
      periods,
      new Set(values.keys()),
    ).map((period) => ({
      key: period.key,
      ...bucketLabels(period, i18n.language),
      values: values.get(period.key) ?? {},
    }))

    return {
      buckets,
      breakdowns: bucketBreakdowns(
        daily ?? [],
        agents?.daily ?? [],
        size,
        weekStartsOn,
      ),
      runs,
      totals,
      products: [...products.values()].sort(
        (a, b) =>
          b.assisted + b.autonomous - (a.assisted + a.autonomous) ||
          a.product.localeCompare(b.product),
      ),
      statuses: [...statuses].sort((a, b) => b[1] - a[1]),
    }
  }, [agents, daily, range, i18n.language])

  const duration = (minutes: number) =>
    formatDurationFromMinutes(Math.round(minutes), t)

  const titles = useMemo(
    () => new Map(projects.map((project) => [project.id, project.title])),
    [projects],
  )

  /** Everything about a bar: people beside agents, and who did what. */
  const describe = (key: string): ChartTooltipContent => {
    const bar = view.breakdowns.get(key)
    const agentMinutes = bar ? bar.agents.assisted + bar.agents.autonomous : 0

    if (!bar || (bar.peopleMinutes === 0 && agentMinutes === 0)) {
      return { rows: [], note: t('dashboard.agents.tooltipEmpty') }
    }

    return {
      rows: [
        {
          label: t('dashboard.agents.humanHours'),
          value: duration(bar.peopleMinutes),
        },
        {
          label: t('dashboard.agents.assisted'),
          value: duration(bar.agents.assisted),
        },
        {
          label: t('dashboard.agents.autonomous'),
          value: duration(bar.agents.autonomous),
        },
        {
          label: t('dashboard.agents.waiting'),
          value: duration(bar.agents.waiting),
        },
        {
          label: t('dashboard.charts.popup.agentsRan'),
          value: String(bar.products.length),
        },
      ],
      sections: [
        {
          title: t('dashboard.charts.popup.byAgent'),
          rows: bar.products.slice(0, POPUP_ROWS).map((product) => ({
            label: product.product,
            value: duration(product.assisted + product.autonomous),
          })),
        },
        {
          title: t('dashboard.insights.cell.projects'),
          rows: bar.projects.slice(0, POPUP_ROWS).map((project) => ({
            label: titles.get(project.projectId) ?? t('dashboard.charts.other'),
            value: duration(project.minutes),
          })),
        },
      ],
    }
  }

  return (
    <DashboardWidget
      title={t('dashboard.agents.title')}
      loading={pending && agents === null}
      failed={failed}
      onRetry={retry}
      empty={
        agents && view.runs === 0
          ? {
              title: t('dashboard.agents.empty.title'),
              description: t('dashboard.agents.empty.description'),
            }
          : undefined
      }
      // Beside the title, where a count belongs, rather than as a loose line
      // under the table.
      aside={
        view.statuses.length > 0 ? (
          <Statuses>
            {view.statuses.map(([status, count]) => (
              <li key={status}>
                {t(`dashboard.agents.status.${status}`, {
                  defaultValue: status,
                })}{' '}
                <b>{count}</b>
              </li>
            ))}
          </Statuses>
        ) : undefined
      }
    >
      <Layout>
        <Figures>
          <Figure>
            <dt>{t('dashboard.agents.runs')}</dt>
            <dd>{view.runs}</dd>
          </Figure>
          <Figure>
            <dt>{t('dashboard.agents.assisted')}</dt>
            <dd>{duration(view.totals.assisted)}</dd>
          </Figure>
          <Figure>
            <dt>{t('dashboard.agents.autonomous')}</dt>
            <dd>{duration(view.totals.autonomous)}</dd>
          </Figure>
          <Figure>
            <dt>{t('dashboard.agents.waiting')}</dt>
            <dd>{duration(view.totals.waiting)}</dd>
          </Figure>
        </Figures>
        <BucketBarChart
          stacked={false}
          height={CHART_HEIGHT}
          buckets={view.buckets}
          series={[
            {
              key: HUMAN,
              label: t('dashboard.agents.humanHours'),
              color: SERIES_COLORS[0],
            },
            {
              key: AGENT,
              label: t('dashboard.agents.agentHours'),
              color: SERIES_COLORS[1],
            },
          ]}
          formatValue={(hours) => duration(hours * 60)}
          formatTick={(hours) =>
            t('dashboard.charts.hoursTick', { value: hours })
          }
          emptyLabel={t('dashboard.agents.tooltipEmpty')}
          describe={describe}
        />
        <Table>
          <colgroup>
            {COLUMN_WIDTHS.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>{t('dashboard.agents.product')}</th>
              <th>{t('dashboard.agents.runs')}</th>
              <th>{t('dashboard.agents.assisted')}</th>
              <th>{t('dashboard.agents.autonomous')}</th>
            </tr>
          </thead>
          <tbody>
            {view.products.map((row) => (
              <tr key={row.product}>
                <td>{row.product}</td>
                <td>{row.runs}</td>
                <td>{duration(row.assisted)}</td>
                <td>{duration(row.autonomous)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Layout>
    </DashboardWidget>
  )
}

const Layout = styled.div`
  display: grid;
  gap: var(--space-4);
`

/* Four cells of the same size, each a small tile of its own, so the strip
   reads as one row of figures rather than four loose labels. */
const Figures = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  dt {
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
    line-height: var(--line-height-1);
  }

  dd {
    margin: 0;
    font-size: var(--font-size-3);
    line-height: var(--line-height-3);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

/* The label may run to two lines ("Waiting on a person" in a quarter of a
   tile); the value sits at the bottom, so the four values stay on one line
   across the strip whatever their labels do. */
const Figure = styled.div`
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 2px;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
`

/* Fixed columns: the figures above and the rows below keep their places
   whatever the numbers are, instead of each state laying the table out anew. */
const Table = styled.table`
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
  font-variant-numeric: tabular-nums;

  th {
    padding: 0 0 var(--space-1);
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
    line-height: var(--line-height-1);
    font-weight: 400;
    text-align: left;
    border-bottom: 1px solid var(--ds-neutral-alpha-6);
  }

  td {
    padding: var(--space-2) 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  tr + tr td {
    border-top: 1px solid var(--ds-neutral-alpha-4);
  }

  th:not(:first-child),
  td:not(:first-child) {
    text-align: right;
  }
`

const Statuses = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  padding: 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  line-height: var(--line-height-1);
  list-style: none;

  b {
    color: var(--ds-neutral-12);
    font-weight: 600;
  }
`
