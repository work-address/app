import { lazy, Suspense } from 'react'
import styled from 'styled-components'

import type { TrailMapProps } from './trail-map'

export {
  hasFix,
  isFix,
  mayBeFaked,
  trailFixes,
  trailLegs,
  type TrailFix,
  type TrailLeg,
  type TrailPoint,
} from './trail'
export type { TrailMapProps } from './trail-map'

// Leaflet loads with the first map anyone opens, not with the app.
const LazyTrailMap = lazy(() => import('./trail-map'))

export const TrailMap = (props: TrailMapProps) => (
  <Suspense fallback={<Placeholder style={{ height: props.height ?? 240 }} />}>
    <LazyTrailMap {...props} />
  </Suspense>
)

const Placeholder = styled.div`
  width: 100%;
  border-radius: 12px;
  background: var(--ui-inset);
`
