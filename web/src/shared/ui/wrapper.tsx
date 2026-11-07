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

/* The workspace page frame: the canvas shows through, and the page's own
   white panels sit inside these insets. */
const Root = styled.div`
  --page-inset-x: var(--ui-page-inset);

  box-sizing: border-box;
  width: 100%;
  padding: var(--ui-page-top) var(--page-inset-x) var(--ui-page-bottom);

  &[data-width='document'] {
    max-width: calc(${DOCUMENT_WIDTH}px + 2 * var(--page-inset-x));
    margin-inline: auto;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    --page-inset-x: var(--ui-page-inset-mobile);

    padding: var(--ui-page-top-mobile) var(--page-inset-x)
      var(--ui-page-bottom-mobile);
  }
`
