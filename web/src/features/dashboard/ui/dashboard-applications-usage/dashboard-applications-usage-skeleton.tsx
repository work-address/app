import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

// Matches Y_AXIS_TICK_COUNT in the chart model, so the grid lands on the same rows.
const TICK_COUNT = 6

// Bar heights as a share of the plot area, so the placeholder reads as a chart
// rather than a flat block.
const BAR_HEIGHTS = ['62%', '84%', '45%', '71%']

export const DashboardApplicationsUsageSkeleton = () => (
  <Root>
    <YAxis>
      {Array.from({ length: TICK_COUNT }, (_, index) => (
        <Skeleton
          key={index}
          width="var(--ui-chart-tick-skeleton-width)"
          height="var(--ui-space-2)"
        />
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
            <Skeleton width="100%" height="var(--ui-space-2)" />
          </Label>
        </Column>
      ))}
    </Plot>
  </Root>
)

const Root = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  height: 100%;
  min-height: var(--ui-chart-min-height);
  padding-top: var(--ui-chart-plot-top);
`

const YAxis = styled.div`
  display: grid;
  justify-items: end;
  align-content: space-between;
  width: var(--ui-chart-y-axis-min-width);
  height: calc(100% - var(--ui-chart-label-area-height));
  padding-right: var(--ui-chart-y-axis-gap);
`

const Plot = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
  padding-right: var(--ui-chart-plot-right);
`

const Grid = styled.div`
  position: absolute;
  inset: 0 var(--ui-chart-plot-right) var(--ui-chart-label-area-height) 0;
  display: grid;
  align-content: space-between;
`

const GridLine = styled.div`
  border-top: var(--ui-border-width) solid var(--ui-line);
`

const Column = styled.div`
  z-index: var(--ui-layer-foreground);
  display: grid;
  grid-template-rows: minmax(0, 1fr) var(--ui-chart-label-area-height);
  justify-items: center;
  height: 100%;
`

const BarArea = styled.div`
  display: grid;
  align-items: end;
  justify-items: center;
  width: 100%;
  height: 100%;
`

const Bar = styled.div`
  width: 100%;
  max-width: var(--ui-chart-bar-width);
  border-radius: var(--ui-chart-bar-radius) var(--ui-chart-bar-radius)
    var(--ui-chart-bar-base-radius) var(--ui-chart-bar-base-radius);
  overflow: hidden;
`

const Label = styled.div`
  width: 100%;
  max-width: var(--ui-space-9);
  height: var(--ui-chart-label-area-height);
  padding-top: var(--ui-chart-tick-margin);
`
