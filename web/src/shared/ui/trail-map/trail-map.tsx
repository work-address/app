import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'

import { trailFixes, trailLegs, type TrailPoint } from './trail'

import { MAP_TILES } from '@/shared/config'

export type TrailMapProps = {
  /**
   * Each trail is joined on its own, so two people's phones, or two days, are
   * never drawn as one line. Hold the array steady between renders: a new one
   * draws the map again.
   */
  trails: readonly (readonly TrailPoint[])[]
  /** What the map shows, for a screen reader. */
  label: string
  /** Said beside a fix the phone said was faked. */
  fakedLabel: string
  formatTime: (at: string) => string
  height?: number
  /** Called with the point as given, so a caller can find it by identity. */
  onFixClick?: (point: TrailPoint) => void
}

const tokenColor = (element: Element, token: string, fallback: string) =>
  getComputedStyle(element).getPropertyValue(token).trim() || fallback

/**
 * Where a phone was: its fixes joined in time order, each with its accuracy
 * circle, dashed across a stretch with no fix, and a faked fix marked. Drawn
 * with Leaflet over the tile host the build names (`MAP_TILES`).
 */
const TrailMap = ({
  trails,
  label,
  fakedLabel,
  formatTime,
  height = 240,
  onFixClick,
}: TrailMapProps) => {
  const ref = useRef<HTMLDivElement>(null)
  // Read when a fix is clicked, so a new callback does not redraw the map.
  const onClick = useRef(onFixClick)
  useEffect(() => {
    onClick.current = onFixClick
  })
  const clickable = onFixClick !== undefined

  useEffect(() => {
    const element = ref.current
    const fixes = trails.flatMap(trailFixes)
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

    for (const leg of trails.flatMap(trailLegs)) {
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
      const marker = L.circleMarker(where, {
        // A point that opens something is a little easier to hit.
        radius: (fix.mock ? 6 : 4) + (clickable ? 1 : 0),
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
      if (clickable) {
        marker.on('click', () => onClick.current?.(fix))
      }
    }

    const bounds = L.latLngBounds(
      fixes.map((fix): L.LatLngTuple => [fix.latitude, fix.longitude]),
    )
    const fit = () => map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })
    fit()
    // A dialog opens with an animation, and a page lays out after the map is
    // drawn, so the map may first be measured at no size or too small: draw
    // again, and frame the trail anew, whenever its size changes, until the
    // reader moves the map themselves: any press on it, to drag, zoom or open
    // a fix, counts.
    let moved = false
    const pressed = () => {
      moved = true
    }
    element.addEventListener('pointerdown', pressed)
    let width = element.clientWidth
    const resized = new ResizeObserver(() => {
      map.invalidateSize()
      if (!moved && element.clientWidth > 0 && element.clientWidth !== width) {
        width = element.clientWidth
        fit()
      }
    })
    resized.observe(element)

    return () => {
      element.removeEventListener('pointerdown', pressed)
      resized.disconnect()
      map.remove()
    }
  }, [trails, fakedLabel, formatTime, clickable])

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
