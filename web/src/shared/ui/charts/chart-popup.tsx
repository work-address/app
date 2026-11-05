import { Theme } from '@radix-ui/themes'
import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'

import type { ReactNode } from 'react'

/** A box in viewport coordinates, as `getBoundingClientRect` gives it. */
export type ChartPopupAnchor = {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * `below` opens under the anchor, or over it where only that fits. `beside`
 * opens to its right, or its left; a screen with room for neither, such as a
 * phone, gets `below` instead.
 */
export type ChartPopupSide = 'below' | 'beside'

type Size = { width: number; height: number }

type Placement = {
  anchor: ChartPopupAnchor
  size: Size
  viewport: Size
  side: ChartPopupSide
  gap?: number
}

const DEFAULT_GAP = 8

/** The least a popup keeps between itself and the edge of the screen. */
const SCREEN_EDGE = 8

/**
 * Where a popup goes: the side with room for all of it, then held on screen.
 * A popup too big for the screen keeps its top left corner on it, since that
 * is where it starts to read.
 */
export const placeChartPopup = ({
  anchor,
  size,
  viewport,
  side,
  gap = DEFAULT_GAP,
}: Placement) => {
  const holdX = (left: number) =>
    Math.max(
      SCREEN_EDGE,
      Math.min(left, viewport.width - size.width - SCREEN_EDGE),
    )
  const holdY = (top: number) =>
    Math.max(
      SCREEN_EDGE,
      Math.min(top, viewport.height - size.height - SCREEN_EDGE),
    )

  if (side === 'beside') {
    const right = anchor.right + gap
    const left = anchor.left - gap - size.width

    if (right + size.width + SCREEN_EDGE <= viewport.width) {
      return { left: right, top: holdY(anchor.top) }
    }
    if (left >= SCREEN_EDGE) {
      return { left, top: holdY(anchor.top) }
    }
  }

  const roomBelow = viewport.height - anchor.bottom - gap - SCREEN_EDGE
  const roomAbove = anchor.top - gap - SCREEN_EDGE
  const opensBelow = roomBelow >= size.height || roomBelow >= roomAbove

  return {
    left: holdX((anchor.left + anchor.right) / 2 - size.width / 2),
    top: holdY(
      opensBelow ? anchor.bottom + gap : anchor.top - gap - size.height,
    ),
  }
}

/** A point inside `element`, such as where recharts says the pointer is. */
export const pointInside = (
  element: HTMLElement | null,
  point?: { x: number; y: number },
): ChartPopupAnchor | null => {
  if (!element || !point) {
    return null
  }
  const box = element.getBoundingClientRect()
  const left = box.left + point.x
  const top = box.top + point.y

  return { left, top, right: left, bottom: top }
}

type Props = {
  /** Asked again on every scroll, so the popup stays with what it describes. */
  anchor: () => ChartPopupAnchor | null | undefined
  side?: ChartPopupSide
  /** Between the anchor and the popup. */
  gap?: number
  /** For columns, which need a width to sit side by side in. */
  width?: number
  children: ReactNode
}

/**
 * The layer a chart's popup is drawn on. Charts live inside scrollers - every
 * dashboard tile is one - and a scroller crops whatever it holds, so the popup
 * is portalled out to the page and placed against the screen instead.
 *
 * Purely something to read: it takes no pointer events, so moving onto it can
 * never end the hover that opened it.
 */
export const ChartPopup = ({
  anchor,
  side = 'beside',
  gap,
  width,
  children,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null)

  // Written straight to the element, before paint: the size is only known once
  // drawn, and a popup following the pointer should not re-render to move.
  useLayoutEffect(() => {
    const place = () => {
      const popup = ref.current
      const box = anchor()

      if (!popup || !box) {
        return
      }
      const { left, top } = placeChartPopup({
        anchor: box,
        size: { width: popup.offsetWidth, height: popup.offsetHeight },
        viewport: {
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
        },
        side,
        gap,
      })

      popup.style.left = `${left}px`
      popup.style.top = `${top}px`
    }

    place()

    // Capturing, because scroll does not bubble: this catches a tile's body as
    // well as the page.
    window.addEventListener('scroll', place, { capture: true, passive: true })
    window.addEventListener('resize', place)

    return () => {
      window.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', place)
    }
  })

  return createPortal(
    // Outside the app's root the theme's tokens would not reach it.
    <Theme asChild>
      <Root
        ref={ref}
        data-wide={width ? true : undefined}
        style={
          width ? { width: `min(${width}px, ${FULL_SCREEN_WIDTH})` } : undefined
        }
      >
        {children}
      </Root>
    </Theme>,
    document.body,
  )
}

const FULL_SCREEN_WIDTH = `calc(100vw - ${SCREEN_EDGE * 2}px)`

/* Over the page, a dialog and a hover card alike: a chart can sit in any of
   them, and the popup is always the last thing the pointer asked for. */
const Root = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: max-content;
  max-width: ${FULL_SCREEN_WIDTH};
  pointer-events: none;
`
