import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useMemo } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'

import type { MotionProps } from 'motion/react'

import { $authenticated } from '@/entities/profile'
import { routes } from '@/routes'
import { useBreakpoint, PageIndicator } from '@/shared'
import { Header } from '@/widgets'

export const MainLayout = () => {
  const { authenticated } = useUnit({
    authenticated: $authenticated,
  })

  if (!authenticated) {
    return <Navigate to={routes.signIn.build()} />
  }

  return (
    <Layout>
      <PageIndicator />
      <StickyHeader>
        <Header />
      </StickyHeader>
      <PageContent />
    </Layout>
  )
}

const PageContent = memo(() => {
  const { pathname } = useLocation()
  const isDesktop = useBreakpoint('isDesktop')

  const motionProps = useMemo(() => {
    if (isDesktop) {
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
  }, [isDesktop])

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
          <WrappedOutlet />
        </motion.div>
      </AnimatePresence>
    </Content>
  )
})

const WrappedOutlet = memo(() => {
  return <Outlet />
})

const Layout = styled.div`
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
