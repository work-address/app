import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { DashboardWidget } from '../dashboard-widget'

import { DashboardApplicationsUsageSkeleton } from './dashboard-applications-usage-skeleton'

import type { ReactNode } from 'react'

type DashboardApplicationsUsageCardProps = {
  isLoading: boolean
  children: ReactNode
}

/** The period comes from the dashboard's filter bar, like every other figure. */
export const DashboardApplicationsUsageCard = ({
  isLoading,
  children,
}: DashboardApplicationsUsageCardProps) => {
  const { t } = useTranslation()

  return (
    <DashboardWidget title={t('dashboard.applicationsUsage.title')}>
      <Plot>
        {isLoading ? <DashboardApplicationsUsageSkeleton /> : children}
      </Plot>
    </DashboardWidget>
  )
}

const Plot = styled.div`
  position: relative;

  .recharts-surface {
    outline: none;
  }
`
