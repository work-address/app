import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { dashboardStatisticsRequested } from '../../model/dashboard-filters'
import { DashboardWidget } from '../dashboard-widget'

import { statisticsTeamQuery } from '@/entities/statistics'
import { formatDurationFromMinutes } from '@/shared'

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

  const duration = (seconds: number) =>
    formatDurationFromMinutes(Math.round(seconds / 60), t)

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
      <Scroll>
        <Table>
          <thead>
            <tr>
              <th>{t('dashboard.team.person')}</th>
              <th>{t('dashboard.team.tracked')}</th>
              <th>{t('dashboard.team.active')}</th>
              <th>{t('dashboard.team.unpaid')}</th>
              <th>{t('dashboard.team.agents')}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.userId}>
                <td>{row.name}</td>
                <td>{duration(row.trackedSeconds)}</td>
                <td>
                  {row.trackedSeconds > 0
                    ? `${Math.round((row.activeSeconds / row.trackedSeconds) * 100)}%`
                    : '—'}
                </td>
                <td>{duration(row.unpaidSeconds)}</td>
                <td>
                  {row.agentSeconds > 0 ? duration(row.agentSeconds) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Scroll>
      <Note>{t('dashboard.team.note')}</Note>
    </DashboardWidget>
  )
}

const Scroll = styled.div`
  overflow-x: auto;
`

const Table = styled.table`
  width: 100%;
  min-width: 520px;
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
