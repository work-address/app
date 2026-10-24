import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { DashboardApplicationsUsageSkeleton } from './dashboard-applications-usage-skeleton'

import type { ReactNode } from 'react'

import { Card, SectionTitle } from '@/shared'

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
    <Root>
      <Head>
        <SectionTitle>{t('dashboard.applicationsUsage.title')}</SectionTitle>
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
  /* The height the period select used to give it, so the card stays level
     with the projects table beside it. */
  min-height: 32px;
  margin-bottom: var(--spacing-5);
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
