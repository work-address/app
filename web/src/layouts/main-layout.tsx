import { Outlet } from 'react-router-dom'
import styled from 'styled-components'

import { Header } from '@/widgets'

export const MainLayout = () => {
  return (
    <Layout>
      <StickyHeader>
        <Header />
      </StickyHeader>

      <Content>
        <Outlet />
      </Content>
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
