import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  buildProjectUsageChart,
  USAGE_PERIOD_TO_STATS_PERIOD,
  type UsagePeriod,
} from '../../model'

import {
  ProjectsDialogUsageChart,
  USAGE_CHART_HEIGHT,
  USAGE_LABEL_AREA_HEIGHT,
  USAGE_PLOT_TOP,
  USAGE_Y_AXIS_GAP,
  USAGE_Y_AXIS_MIN_WIDTH,
} from './projects-dialog-usage-chart'

import type { ProjectWithStats } from '@/entities/projects'

import {
  $projectProcessStats,
  $projectProcessStatsLoading,
  fetchProjectProcessStats,
} from '@/entities/projects'
import {
  Card,
  EmptyStateDescription,
  EmptyStateTitle,
  HOUR_AXIS_TICK_COUNT,
  SectionTitle,
  Select,
} from '@/shared'

// Bar heights as a share of the plot area, so the placeholder reads as a chart
// rather than a flat block.
const SKELETON_BAR_HEIGHTS = ['68%', '52%', '84%', '40%']

type ProjectsDialogUsageProps = {
  data: ProjectWithStats
}

export const ProjectsDialogUsage = ({ data }: ProjectsDialogUsageProps) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<UsagePeriod>('Month')

  const { stats, isFetching, fetchStats } = useUnit({
    stats: $projectProcessStats,
    isFetching: $projectProcessStatsLoading,
    fetchStats: fetchProjectProcessStats,
  })

  const projectId = data.id ?? ''
  const tracksProcesses = Boolean(data.trackProcesses)

  useEffect(() => {
    if (!projectId || !tracksProcesses) {
      return
    }

    fetchStats({ projectId, period: USAGE_PERIOD_TO_STATS_PERIOD[period] })
  }, [projectId, tracksProcesses, period, fetchStats])

  // The query store is shared across dialog openings, so it still holds the
  // previously opened project until this project's fetch lands.
  const projectStats = stats?.projectId === projectId ? stats : null

  const chart = useMemo(
    () => buildProjectUsageChart(projectStats),
    [projectStats],
  )

  const renderBody = () => {
    if (!tracksProcesses) {
      return (
        <UsagePlaceholder
          title={t('dashboard.applicationsUsage.empty.trackingOff.title')}
          description={t(
            'dashboard.applicationsUsage.empty.trackingOff.description',
          )}
        />
      )
    }

    if (isFetching || !projectStats) {
      return <UsageSkeleton />
    }

    if (projectStats.failed) {
      return (
        <UsagePlaceholder
          title={t('dashboard.applicationsUsage.loadError')}
          description={t('dashboard.applicationsUsage.tooltip.loadFailed')}
        />
      )
    }

    if (chart.data.length === 0) {
      return (
        <UsagePlaceholder
          title={t('dashboard.applicationsUsage.empty.noActivity.title')}
          description={t(
            'dashboard.applicationsUsage.empty.noActivity.description',
          )}
        />
      )
    }

    return <ProjectsDialogUsageChart data={chart.data} yAxis={chart.yAxis} />
  }

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
            onChange={(value) => setPeriod(value as UsagePeriod)}
          />
        </PeriodSelect>
      </Head>
      <Body>
        <Plot>{renderBody()}</Plot>
      </Body>
    </Root>
  )
}

// The grid stays behind the copy so a chartless card still reads as a chart
// with nothing to plot yet, rather than as a blank panel.
const UsagePlaceholder = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <PlaceholderRoot>
    <PlotGrid aria-hidden>
      {Array.from({ length: HOUR_AXIS_TICK_COUNT }, (_, index) => (
        <GridLine key={index} />
      ))}
    </PlotGrid>
    <Message>
      <EmptyStateTitle>{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </Message>
  </PlaceholderRoot>
)

const UsageSkeleton = () => (
  <SkeletonRoot>
    <SkeletonYAxis>
      {Array.from({ length: HOUR_AXIS_TICK_COUNT }, (_, index) => (
        <Skeleton key={index} width="18px" height="8px" />
      ))}
    </SkeletonYAxis>
    <SkeletonPlot>
      <PlotGrid aria-hidden>
        {Array.from({ length: HOUR_AXIS_TICK_COUNT }, (_, index) => (
          <GridLine key={index} />
        ))}
      </PlotGrid>
      {SKELETON_BAR_HEIGHTS.map((height, index) => (
        <SkeletonColumn key={index}>
          <SkeletonBarArea>
            <SkeletonBar style={{ height }}>
              <Skeleton width="100%" height="100%" />
            </SkeletonBar>
          </SkeletonBarArea>
          <SkeletonLabel>
            <Skeleton width="100%" height="8px" />
          </SkeletonLabel>
        </SkeletonColumn>
      ))}
    </SkeletonPlot>
  </SkeletonRoot>
)

const Root = styled.div`
  min-width: 0;
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: var(--spacing-5);
`

const PeriodSelect = styled.div`
  width: 110px;

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
`

const PlaceholderRoot = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${USAGE_CHART_HEIGHT}px;
`

const PlotGrid = styled.div`
  position: absolute;
  inset: ${USAGE_PLOT_TOP}px 8px ${USAGE_LABEL_AREA_HEIGHT}px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

const GridLine = styled.div`
  border-top: 1px dashed var(--c-rgba-0-0-51-0_12);
`

const Message = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  /* Opaque so the grid behind reads as a backdrop instead of striking through
     the copy; the card sets the same background. */
  padding: 12px 16px;
  background: var(--white);
`

const SkeletonRoot = styled.div`
  display: flex;
  height: ${USAGE_CHART_HEIGHT}px;
  padding-top: ${USAGE_PLOT_TOP}px;
`

const SkeletonYAxis = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  width: ${USAGE_Y_AXIS_MIN_WIDTH}px;
  height: calc(100% - ${USAGE_LABEL_AREA_HEIGHT}px);
  padding-right: ${USAGE_Y_AXIS_GAP}px;
`

const SkeletonPlot = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: space-around;
  padding-right: 8px;
`

const SkeletonColumn = styled.div`
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
`

const SkeletonBarArea = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: calc(100% - ${USAGE_LABEL_AREA_HEIGHT}px);
`

const SkeletonBar = styled.div`
  width: 100%;
  max-width: 64px;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
`

const SkeletonLabel = styled.div`
  width: 100%;
  max-width: 56px;
  height: ${USAGE_LABEL_AREA_HEIGHT}px;
  padding-top: 10px;
`
