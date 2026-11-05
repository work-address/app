import styled from 'styled-components'

import type { ReactNode } from 'react'

/**
 * `full` is for the pages (dashboard, invoices, an invoice with its worklog
 * tables, a profile and its form) that want every column they can get;
 * `document` is the narrow column for a lone notice (not found, a load
 * failure). Both share the same insets, so the first line of every page starts
 * at the same height and switching tabs does not jump.
 */
export type WrapperWidth = 'full' | 'document'

type Props = {
  children: ReactNode
  width?: WrapperWidth
  className?: string
}

export const Wrapper = ({ children, width = 'full', className }: Props) => {
  return (
    <Root data-width={width} className={className}>
      {children}
    </Root>
  )
}

/** The reading column's content width, shared by every `document` page. */
export const DOCUMENT_WIDTH = 960

const Root = styled.div`
  --page-inset-x: 28px;

  box-sizing: border-box;
  width: 100%;
  background: var(--white);
  border-radius: 40px 40px 0 0;
  padding: 32px var(--page-inset-x) 40px;

  &[data-width='document'] {
    max-width: calc(${DOCUMENT_WIDTH}px + 2 * var(--page-inset-x));
    margin-inline: auto;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    --page-inset-x: 16px;

    padding: 18px var(--page-inset-x) 24px;
    border-radius: 24px 24px 0 0;
  }
`
