import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { DashboardApplicationsUsageSkeleton } from './dashboard-applications-usage-skeleton'

import type { Period } from '../../model'
import type { ReactNode } from 'react'

import { Card, Select, SectionTitle } from '@/shared'

type DashboardApplicationsUsageCardProps = {
  period: Period
  isLoading: boolean
  onPeriodChange: (period: Period) => void
  children: ReactNode
}

export const DashboardApplicationsUsageCard = ({
  period,
  isLoading,
  onPeriodChange,
  children,
}: DashboardApplicationsUsageCardProps) => {
  const { t } = useTranslation()

  return (
    <Root>
      <Head>
        <SectionTitle>{t('dashboard.applicationsUsage.title')}</SectionTitle>
        <PeriodSelect>
          <Select
            options={[
              {
                value: 'Week',
                label: t('dashboard.applicationsUsage.period.week'),
              },
              {
                value: 'Month',
                label: t('dashboard.applicationsUsage.period.month'),
              },
              {
                value: 'Year',
                label: t('dashboard.applicationsUsage.period.year'),
              },
            ]}
            value={period}
            onChange={(v) => onPeriodChange(v as Period)}
          />
        </PeriodSelect>
      </Head>
      <Body>
        <Plot>
          {isLoading ? <DashboardApplicationsUsageSkeleton /> : children}
        </Plot>
      </Body>
    </Root>
  )
}

const Root = styled.aside`
  width: 100%;
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 25px;
`

const PeriodSelect = styled.div`
  width: 120px;

  button {
    height: 32px;
  }
`

const Body = styled(Card)`
  padding: 12px 12px 14px;
`

const Plot = styled.div`
  position: relative;
  padding: 10px;
  border-radius: 10px;
  background: var(--white);

  .recharts-surface {
    outline: none;
  }
`
