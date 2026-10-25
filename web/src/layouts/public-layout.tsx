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

type PageContentProps = {
  /** The sheet the page scrolls in, so a route change starts at its top. */
  scrollRef: RefObject<HTMLElement | null>
}

const PageContent = memo(({ scrollRef }: PageContentProps) => {
  const { pathname } = useLocation()
  const isDesktop = useBreakpoint('isDesktop')
  const reducedMotion = useReducedMotion()
  const skeletonVariant =
    pathname === routes.dashboard.build() ||
    pathname === routes.invoices.build()
      ? 'list'
      : 'document'

  const motionProps = useMemo(() => {
    if (isDesktop && !reducedMotion) {
      return {
        initial: {
          opacity: 0,
          x: -100,
        },
        animate: {
          opacity: 1,
          x: 0,
        },
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
 * scrolls inside, so the sheet's rounded frame stays put as the page moves.
 */
const Root = styled.div`
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: var(--sidebar-bg);

  @media print {
    height: auto;
    overflow: visible;
  }
`

/**
 * The page sits on the sidebar's grey as one white sheet, rounded where it
 * meets the sidebar and flush with the viewport's other three edges. The
 * sheet itself does not scroll: the page indicator sits on it, above the
 * mask the scroller below wears.
 */
const Main = styled.main`
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 40px 0 0 40px;
  overflow: hidden;
  background: var(--white);
  box-shadow: var(--shadow-4);

  ${(p) => p.theme.breakpoints.up('md')} {
    /* Above the fixed sidebar, so the shadow falls onto it. On a phone the
       sidebar opens over the page and has to stay on top instead. */
    z-index: 21;
  }

  @media print {
    border-radius: 0;
    overflow: visible;
    box-shadow: none;
  }
`

/**
 * The page's scroll container. Content leaving at either end dissolves over
 * the sheet's edge instead of being cut by it; the mask sits on the scroller,
 * so it stays put while the page moves under it.
 */
const Scroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* none, not contain: Chrome on macOS bounces inner scrollers too, which
     slides the page down and bares the sheet's white above it. */
  overscroll-behavior: none;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    var(--c-000000) 40px,
    var(--c-000000) calc(100% - 40px),
    transparent
  );

  @media print {
    overflow: visible;
    mask-image: none;
  }
`

const Content = styled.div`
  /* Clips the route's slide-in at the sheet's edge without becoming a scroll
     container the way overflow: hidden would. */
  overflow-x: clip;
  border-radius: inherit;
`
