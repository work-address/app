import { useEffect, useRef, type RefObject } from 'react'

const REACH_END_THRESHOLD_PX = 120

type UseReachEndOptions = {
  onReachEnd?: () => void
  /**
   * The element that scrolls the list, when it is not the page.
   *
   * Pass it only for a list that scrolls inside its own box. A list that grows
   * with its data never scrolls its sentinel out of that box, so watching it
   * there would report an intersection for every appended page.
   */
  rootRef?: RefObject<HTMLElement | null>
  /** Re-arms the observer when it changes; normally the loaded item count. */
  resetKey: number
}

/**
 * Asks for the next page as the end of a list comes into view.
 *
 * Returns the ref to put on a sentinel element rendered after the last item.
 */
export const useReachEnd = ({
  onReachEnd,
  rootRef,
  resetKey,
}: UseReachEndOptions) => {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onReachEndRef = useRef(onReachEnd)

  useEffect(() => {
    onReachEndRef.current = onReachEnd
  })

  const hasHandler = Boolean(onReachEnd)
  const isSelfScrolling = Boolean(rootRef)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = rootRef?.current ?? null

    if (!hasHandler || !sentinel || (isSelfScrolling && !root)) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onReachEndRef.current?.()
        }
      },
      { root, rootMargin: `0px 0px ${REACH_END_THRESHOLD_PX}px 0px` },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
    // Re-observing after each appended page re-reports the current
    // intersection, so a page shorter than the root margin still asks for the
    // next one. Deliberately not keyed on the loading flag: a failed request
    // must not re-trigger by itself, the user retries by scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHandler, isSelfScrolling, resetKey])

  return sentinelRef
}
