import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'

import { trailFixes, trailLegs, type TrailPoint } from './trail'

import { MAP_TILES } from '@/shared/config'

export type TrailMapProps = {
  points: readonly TrailPoint[]
  /** What the map shows, for a screen reader. */
  label: string
  /** Said beside a fix the phone said was faked. */
  fakedLabel: string
  formatTime: (at: string) => string
  height?: number
}

const tokenColor = (element: Element, token: string, fallback: string) =>
  getComputedStyle(element).getPropertyValue(token).trim() || fallback

/**
 * Where a phone was: its fixes joined in time order, each with its accuracy
 * circle, dashed across a stretch with no fix, and a faked fix marked. Drawn
 * with Leaflet over the tile host the build names (`MAP_TILES`).
 */
const TrailMap = ({
  points,
  label,
  fakedLabel,
  formatTime,
  height = 240,
}: TrailMapProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const fixes = trailFixes(points)
    if (!element || fixes.length === 0) {
      return
    }

    const line = tokenColor(element, '--accent-9', '#3e63dd')
    const faked = tokenColor(element, '--red-9', '#e5484d')
    const map = L.map(element, { scrollWheelZoom: false })
    L.tileLayer(MAP_TILES.url, {
      attribution: MAP_TILES.attribution,
      maxZoom: 19,
    }).addTo(map)

    for (const leg of trailLegs(points)) {
      L.polyline(
        [
          [leg.from.latitude, leg.from.longitude],
          [leg.to.latitude, leg.to.longitude],
        ],
        {
          color: line,
          weight: 3,
          opacity: leg.known ? 0.85 : 0.6,
          dashArray: leg.known ? undefined : '4 8',
          interactive: false,
        },
      ).addTo(map)
    }

    for (const fix of fixes) {
      const color = fix.mock ? faked : line
      const where: L.LatLngTuple = [fix.latitude, fix.longitude]
      if (fix.accuracy) {
        L.circle(where, {
          radius: fix.accuracy,
          color,
          weight: 1,
          opacity: 0.35,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(map)
      }
      L.circleMarker(where, {
        radius: fix.mock ? 6 : 4,
        color,
        weight: 2,
        fillColor: fix.mock ? faked : '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(
          fix.mock
            ? `${formatTime(fix.at)} · ${fakedLabel}`
            : formatTime(fix.at),
        )
        .addTo(map)
    }

    const bounds = L.latLngBounds(
      fixes.map((fix): L.LatLngTuple => [fix.latitude, fix.longitude]),
    )
    const fit = () => map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })
    fit()
    // A dialog opens with an animation, so the map may first be measured at
    // no size: draw again, and frame the trail, once it has one.
    let framed = element.clientWidth > 0
    const resized = new ResizeObserver(() => {
      map.invalidateSize()
      if (!framed && element.clientWidth > 0) {
        framed = true
        fit()
      }
    })
    resized.observe(element)

    return () => {
      resized.disconnect()
      map.remove()
    }
  }, [points, fakedLabel, formatTime])

  return <Root ref={ref} role="img" aria-label={label} style={{ height }} />
}

export default TrailMap

// Leaflet stacks its panes with z-indexes of its own; kept inside the map.
const Root = styled.div`
  isolation: isolate;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: var(--ui-inset);
`
