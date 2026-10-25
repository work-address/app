import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

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
} from '@/shared'

const HUMAN = 'human'
const AGENT = 'agent'

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

  const { range, agents, daily, pending, failed, retry } = useUnit({
    range: $dashboardRange,
    agents: statisticsAgentsQuery.$data,
    daily: statisticsDailyQuery.$data,
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
          height={200}
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
        />
        <Table>
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
        {view.statuses.length > 0 && (
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
        )}
      </Layout>
    </DashboardWidget>
  )
}

const Layout = styled.div`
  display: grid;
  gap: var(--space-4);
`

const Figures = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  dt {
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
  }

  dd {
    margin: 0;
    font-size: var(--font-size-4);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const Figure = styled.div`
  display: grid;
  gap: 2px;
  min-width: 0;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);
  font-variant-numeric: tabular-nums;

  th {
    padding: 6px 8px 6px 0;
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
    font-weight: 400;
    text-align: left;
  }

  td {
    padding: 8px 8px 8px 0;
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
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  list-style: none;

  b {
    color: var(--ds-neutral-12);
    font-weight: 600;
  }
`
