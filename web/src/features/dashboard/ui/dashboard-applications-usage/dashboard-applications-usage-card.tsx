import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { DashboardWidget } from '../dashboard-widget'

import { DashboardApplicationsUsageSkeleton } from './dashboard-applications-usage-skeleton'

import type { ReactNode } from 'react'

type DashboardApplicationsUsageCardProps = {
  isLoading: boolean
  /** Shown instead of the plot when there is nothing to stack. */
  empty?: { title: string; description?: string }
  children: ReactNode
}

/** The period comes from the dashboard's filter bar, like every other figure. */
export const DashboardApplicationsUsageCard = ({
  isLoading,
  empty,
  children,
}: DashboardApplicationsUsageCardProps) => {
  const { t } = useTranslation()

  return (
    <DashboardWidget
      title={t('dashboard.applicationsUsage.title')}
      empty={isLoading ? undefined : empty}
    >
      <Plot>
        {isLoading ? <DashboardApplicationsUsageSkeleton /> : children}
      </Plot>
    </DashboardWidget>
  )
}

const Plot = styled.div`
  position: relative;
  height: 100%;

  .recharts-surface {
    outline: none;
  }
`
