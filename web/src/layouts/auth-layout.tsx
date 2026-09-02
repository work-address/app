import { matchPath, Outlet, useLocation } from 'react-router-dom'
import styled, { css } from 'styled-components'

import { routes } from '@/routes'
import { SignBg } from '@/shared/icons'

export const AuthLayout = () => {
  const { pathname } = useLocation()
  // On large screens the sign-in page owns the whole viewport (no scroll),
  // so it opts out of the Stage offset that centers the other auth pages.
  const fullScreen = matchPath(routes.signIn.schema, pathname) !== null

  return (
    <Root $fullScreen={fullScreen}>
      <Stage $fullScreen={fullScreen}>
        <Outlet />
      </Stage>
    </Root>
  )
}

/* The sign-in page paints its own two panels edge to edge; the patterned
   backdrop is for the smaller auth pages that sit in a card on top of it. */
const Root = styled.main<{ $fullScreen: boolean }>`
  min-height: 100vh;
  background: ${(p) =>
    p.$fullScreen ? 'var(--white)' : `url(${SignBg}) center / cover no-repeat`};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

const Stage = styled.div<{ $fullScreen: boolean }>`
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

  /* Doubled so it outranks the breakpoint rules above, which are emitted
     after the base declarations and would otherwise restore the offset. */
  ${({ $fullScreen }) =>
    $fullScreen &&
    css`
      && {
        margin: 0;
        padding: 0;
        width: 100%;
      }
    `}
`
