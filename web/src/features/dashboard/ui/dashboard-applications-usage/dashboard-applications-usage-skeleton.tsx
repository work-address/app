import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

// Mirrors the geometry of the real chart so the plot area doesn't jump once the
// data arrives: same height, same y-axis gutter, same bar cap.
const CHART_HEIGHT = 306
const LABEL_AREA_HEIGHT = 30
const Y_AXIS_WIDTH = 34
// Matches Y_AXIS_TICK_COUNT in the chart model, so the grid lands on the same rows.
const TICK_COUNT = 6

// Bar heights as a share of the plot area, so the placeholder reads as a chart
// rather than a flat block.
const BAR_HEIGHTS = ['62%', '84%', '45%', '71%']

export const DashboardApplicationsUsageSkeleton = () => (
  <Root>
    <YAxis>
      {Array.from({ length: TICK_COUNT }, (_, index) => (
        <Skeleton key={index} width="18px" height="8px" />
      ))}
    </YAxis>
    <Plot>
      <Grid aria-hidden>
        {Array.from({ length: TICK_COUNT }, (_, index) => (
          <GridLine key={index} />
        ))}
      </Grid>
      {BAR_HEIGHTS.map((height, index) => (
        <Column key={index}>
          <BarArea>
            <Bar style={{ height }}>
              <Skeleton width="100%" height="100%" />
            </Bar>
          </BarArea>
          <Label>
            <Skeleton width="100%" height="8px" />
          </Label>
        </Column>
      ))}
    </Plot>
  </Root>
)

const Root = styled.div`
  display: flex;
  height: ${CHART_HEIGHT}px;
  padding-top: 6px;
`

const YAxis = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  width: ${Y_AXIS_WIDTH}px;
  height: calc(100% - ${LABEL_AREA_HEIGHT}px);
  padding-right: 8px;
`

const Plot = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: space-around;
  padding-right: 8px;
`

const Grid = styled.div`
  position: absolute;
  inset: 0 8px ${LABEL_AREA_HEIGHT}px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

const GridLine = styled.div`
  border-top: 1px dashed var(--c-rgba-0-0-51-0_12);
`

const Column = styled.div`
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
`

const BarArea = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: calc(100% - ${LABEL_AREA_HEIGHT}px);
`

const Bar = styled.div`
  width: 100%;
  max-width: 80px;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
`

const Label = styled.div`
  width: 100%;
  max-width: 64px;
  height: ${LABEL_AREA_HEIGHT}px;
  padding-top: 10px;
`
