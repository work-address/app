import styled from 'styled-components'

import { Wrapper } from '../wrapper'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

/** Page insets for a route explicitly using the workspace design. */
export const WorkspacePage = ({ children, className }: Props) => (
  <Root className={className}>{children}</Root>
)

const Root = styled(Wrapper)`
  --page-inset-x: var(--ui-page-inset);

  min-height: 100dvh;
  padding-block: var(--ui-page-top) var(--ui-page-bottom);
  background: transparent;
  border-radius: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    --page-inset-x: var(--ui-page-inset-mobile);
    --ui-card-inset: var(--ui-card-inset-mobile);

    padding-block: var(--ui-page-top-mobile) var(--ui-page-bottom-mobile);
  }
`
