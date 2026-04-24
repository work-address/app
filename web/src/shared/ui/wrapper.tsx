import styled from 'styled-components'

import type { ReactNode } from 'react'

export const Wrapper = ({ children }: { children: ReactNode }) => {
  return <WrapperWhite> {children} </WrapperWhite>
}

const WrapperWhite = styled.div`
  background: var(--white);
  border-radius: 40px 40px 0 0;
  padding: 32px 28px 60px 28px;

  @media (max-width: 768px) {
    padding: 18px 16px;
    border-radius: 24px 24px 0 0;
  }

  @media (max-width: 440px) {
    padding-bottom: 0;
  }
`
