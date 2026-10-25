import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { dashboardStatisticsRequested } from '../../model/dashboard-filters'
import { DashboardWidget } from '../dashboard-widget'

import {
  statisticsTeamQuery,
  type StatisticsTeamRow,
} from '@/entities/statistics'
import { formatDurationFromMinutes, useBreakpoint } from '@/shared'

const EMPTY_ROW: StatisticsTeamRow = {
  userId: '',
  name: '',
  trackedSeconds: 0,
  activeSeconds: 0,
  unpaidSeconds: 0,
  agentSeconds: 0,
}

/**
 * Everyone's time on the reader's own projects, by name. Deliberately not
 * sortable by any figure: it is a breakdown, never a ranking.
 */
export const DashboardTeam = () => {
  const { t } = useTranslation()

  const { rows, pending, failed, retry } = useUnit({
    rows: statisticsTeamQuery.$data,
    pending: statisticsTeamQuery.$pending,
    failed: statisticsTeamQuery.$failed,
    retry: dashboardStatisticsRequested,
  })

  const isMobile = useBreakpoint('isMobile')

  const duration = (seconds: number) =>
    formatDurationFromMinutes(Math.round(seconds / 60), t)

  // No activity is shown as none rather than 0%: until a worker's entries pass
  // their review window the owner sees their time but not its activity.
  const active = (row: StatisticsTeamRow) =>
    row.trackedSeconds > 0 && row.activeSeconds > 0
      ? `${Math.round((row.activeSeconds / row.trackedSeconds) * 100)}%`
      : '—'

  const figures = (row: StatisticsTeamRow) => [
    [t('dashboard.team.tracked'), duration(row.trackedSeconds)],
    [t('dashboard.team.active'), active(row)],
    [t('dashboard.team.unpaid'), duration(row.unpaidSeconds)],
    [
      t('dashboard.team.agents'),
      row.agentSeconds > 0 ? duration(row.agentSeconds) : '—',
    ],
  ]

  return (
    <DashboardWidget
      title={t('dashboard.team.title')}
      loading={pending && rows === null}
      failed={failed}
      onRetry={retry}
      empty={
        rows && rows.length === 0
          ? {
              title: t('dashboard.team.empty.title'),
              description: t('dashboard.team.empty.description'),
            }
          : undefined
      }
    >
      {/* A phone has no room for five columns: each person becomes a block
          of their four figures instead of a row that scrolls sideways. */}
      {isMobile ? (
        <People>
          {(rows ?? []).map((row) => (
            <li key={row.userId}>
              <Name>{row.name}</Name>
              <Figures>
                {figures(row).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </Figures>
            </li>
          ))}
        </People>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('dashboard.team.person')}</th>
              {figures((rows ?? [])[0] ?? EMPTY_ROW).map(([label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.userId}>
                <td>{row.name}</td>
                {figures(row).map(([label, value]) => (
                  <td key={label}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Note>{t('dashboard.team.note')}</Note>
    </DashboardWidget>
  )
}

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-2);
  font-variant-numeric: tabular-nums;

  th {
    padding: 6px 12px 6px 0;
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
    font-weight: 400;
    text-align: left;
  }

  td {
    padding: 10px 12px 10px 0;
    border-top: 1px solid var(--ds-neutral-alpha-4);
  }

  th:not(:first-child),
  td:not(:first-child) {
    text-align: right;
  }
`

const Note = styled.p`
  margin: var(--space-3) 0 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
`

const People = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) 0;
  }

  li + li {
    border-top: 1px solid var(--ds-neutral-alpha-4);
  }

  li:first-child {
    padding-top: 0;
  }
`

const Name = styled.span`
  font-size: var(--font-size-2);
  font-weight: 500;
`

const Figures = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-3);
  margin: 0;

  dt {
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
  }

  dd {
    margin: 0;
    font-size: var(--font-size-2);
    font-variant-numeric: tabular-nums;
  }
`
