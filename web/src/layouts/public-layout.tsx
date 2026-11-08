import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'

import type { MotionProps } from 'motion/react'
import type { RefObject } from 'react'

import { routes } from '@/routes'
import { useBreakpoint, PageIndicator, RouteSkeleton } from '@/shared'
import { Sidebar } from '@/widgets'

export const PublicLayout = () => {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <Root>
      <Sidebar />
      <Main>
        <PageIndicator />
        <Scroller ref={scrollRef}>
          <PageContent scrollRef={scrollRef} />
        </Scroller>
      </Main>
    </Root>
  )
}

const LIST_ROUTES = new Set([
  routes.dashboard.build(),
  routes.time.build(),
  routes.invoices.build(),
])

type PageContentProps = {
  /** The sheet the page scrolls in, so a route change starts at its top. */
  scrollRef: RefObject<HTMLElement | null>
}

const PageContent = memo(({ scrollRef }: PageContentProps) => {
  const { pathname } = useLocation()
  const isDesktop = useBreakpoint('isDesktop')
  const reducedMotion = useReducedMotion()
  // The list pages open with a summary strip; the rest with one sheet.
  const skeletonVariant = LIST_ROUTES.has(pathname) ? 'list' : 'document'

  const motionProps = useMemo(() => {
    if (isDesktop && !reducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3, ease: 'easeInOut' },
      } satisfies MotionProps
    } else {
      return {
        transition: { duration: 0 },
      } satisfies MotionProps
    }
  }, [isDesktop, reducedMotion])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, scrollRef])

  return (
    <Content>
      <AnimatePresence mode="wait">
        <motion.div key={pathname} {...motionProps}>
          <Suspense fallback={<RouteSkeleton variant={skeletonVariant} />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Content>
  )
})

/**
 * The viewport, not the document: the sheet below fills it and the page
 * scrolls inside, so the sheet stays put as the page moves.
 */
const Root = styled.div`
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: var(--sidebar-bg);

  /* Blocks all the way down: a page break inside a flex column is up to the
     browser, and some cut the page there rather than carry it over. */
  @media print {
    display: block;
    height: auto;
    overflow: visible;
  }
`

/**
 * The page sits beside the sidebar's grey as one white sheet, flush with the
 * viewport's edges. The sheet itself does not scroll: the page indicator sits
 * on it, above the mask the scroller below wears.
 */
const Main = styled.main`
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--page-canvas, var(--ui-surface));
  box-shadow: var(--page-shadow, var(--ui-shadow));

  ${(p) => p.theme.breakpoints.up('md')} {
    /* Above the fixed sidebar, so the shadow falls onto it. On a phone the
       sidebar opens over the page and has to stay on top instead. */
    z-index: 21;
  }

  @media print {
    display: block;
    overflow: visible;
    box-shadow: none;
  }
`

/** The page's scroll container: the canvas stays put while the page moves. */
const Scroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* none, not contain: Chrome on macOS bounces inner scrollers too, which
     slides the page down and bares the sheet's white above it. */
  overscroll-behavior: none;

  @media print {
    overflow: visible;
  }
`

const Content = styled.div`
  /* Clips anything wider than the sheet at its edge without becoming a scroll
     container the way overflow: hidden would. */
  overflow-x: clip;
  border-radius: inherit;

  @media print {
    overflow: visible;
  }
`
