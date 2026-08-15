import styled from 'styled-components'

import type { ReactNode } from 'react'

export const Wrapper = ({ children }: { children: ReactNode }) => {
  return <Root>{children}</Root>
}

const Root = styled.div`
  background: var(--white);
  border-radius: 40px 40px 0 0;
  padding: 32px 28px;

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 18px 16px;
    border-radius: 24px 24px 0 0;
  }

  ${(p) => p.theme.breakpoints.down('sm')} {
    padding-bottom: 0;
  }
`
