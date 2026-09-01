import styled from 'styled-components'

import { EmptyStateDescription, EmptyStateTitle } from '@/shared'

// Mirrors the geometry of the real chart and the skeleton so the card keeps its
// height whichever of the three is on screen. Keep in sync with them.
const CHART_HEIGHT = 306
const PLOT_TOP = 6
const LABEL_AREA_HEIGHT = 30
const Y_AXIS_WIDTH = 40
// Matches Y_AXIS_TICK_COUNT in the chart model, so the grid lands on the same rows.
const TICK_COUNT = 6

type DashboardApplicationsUsageEmptyProps = {
  title: string
  description: string
}

// The grid stays behind the copy so an empty card still reads as a chart that
// has nothing to plot yet, rather than as a blank panel.
export const DashboardApplicationsUsageEmpty = ({
  title,
  description,
}: DashboardApplicationsUsageEmptyProps) => (
  <Root>
    <Grid aria-hidden>
      {Array.from({ length: TICK_COUNT }, (_, index) => (
        <GridLine key={index} />
      ))}
    </Grid>
    <Message>
      <EmptyStateTitle>{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </Message>
  </Root>
)

const Root = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${CHART_HEIGHT}px;
`

const Grid = styled.div`
  position: absolute;
  inset: ${PLOT_TOP}px 8px ${LABEL_AREA_HEIGHT}px ${Y_AXIS_WIDTH}px;
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
  /* Opaque so the grid behind reads as a backdrop instead of striking through
     the copy; the card sets the same background. */
  padding: 12px 16px;
  background: var(--white);
`
