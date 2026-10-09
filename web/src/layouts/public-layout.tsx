import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, Suspense, useEffect, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'

import type { MotionProps } from 'motion/react'

import { routes } from '@/routes'
import { useBreakpoint, PageIndicator, RouteSkeleton } from '@/shared'
import { Header } from '@/widgets'

export const PublicLayout = () => {
  return (
    <Root>
      <PageIndicator />
      <StickyHeader>
        <Header />
      </StickyHeader>
      <PageContent />
    </Root>
  )
}

const PageContent = memo(() => {
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
    document.body.scrollIntoView({
      behavior: 'instant',
      block: 'start',
    })
  }, [pathname])

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

const Root = styled.div`
  height: 100%;
  background: var(--ds-secondary);
  position: relative;
`

const StickyHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
`

const Content = styled.div`
  overflow: auto;
  background: var(--white);

  border-top-left-radius: 40px;
  border-top-right-radius: 40px;
`
