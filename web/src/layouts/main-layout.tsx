import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'

import type { MotionProps } from 'motion/react'

import { $authenticated, $pending } from '@/entities/profile'
import { routes } from '@/routes'
import { useBreakpoint, PageIndicator } from '@/shared'
import { Header } from '@/widgets'

export const MainLayout = () => {
  const { authenticated, authenticationPending } = useUnit({
    authenticated: $authenticated,
    authenticationPending: $pending,
  })

  if (authenticationPending) {
    return null
  }

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

  const motionProps: MotionProps | null = isDesktop
    ? {
        initial: { opacity: 0, y: 50 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -50 },
        transition: { duration: 0.35 },
      }
    : null

  return (
    <AnimatePresence mode={'wait'}>
      <Content>
        <motion.div key={pathname} {...motionProps}>
          <Outlet />
        </motion.div>
      </Content>
    </AnimatePresence>
  )
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
