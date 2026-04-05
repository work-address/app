import { AnimatePresence, motion } from 'motion/react'
import { Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'

import { Header } from '@/widgets'

export const MainLayout = () => {
  const { pathname } = useLocation()

  return (
    <Layout>
      <StickyHeader>
        <Header />
      </StickyHeader>

      <AnimatePresence mode={'wait'}>
        <Content>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.35 }}
          >
            <Outlet />
          </motion.div>
        </Content>
      </AnimatePresence>
    </Layout>
  )
}

const Layout = styled.div`
  height: 100%;
  background: var(--ds-secondary);
  position: relative;
`

const StickyHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
`

const Content = styled.div`
  overflow: auto;
  background: var(--white);

  border-top-left-radius: 40px;
  border-top-right-radius: 40px;
`
