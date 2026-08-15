import { Outlet } from 'react-router-dom'
import styled from 'styled-components'

import { SignBg } from '@/shared/icons'

export const AuthLayout = () => {
  return (
    <Root>
      <Stage>
        <Outlet />
      </Stage>
    </Root>
  )
}

const Root = styled.main`
  min-height: 100vh;
  background: url(${SignBg}) center / cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

const Stage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 16px;
  margin: 10px 0 0 0;

  ${({ theme }) => theme.breakpoints.up('md')} {
    padding: 0;
    margin: 44px 0 0 0;
  }
`
