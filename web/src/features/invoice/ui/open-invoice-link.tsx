import { useUnit } from 'effector-react'
import styled from 'styled-components'

import { ensureInvoiceMutation } from '../model'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'

import { Button } from '@/shared'

type OpenInvoiceLinkVariant = 'inline' | 'button'

/**
 * Opens the invoice for a project.
 *
 * Not a plain link: `/invoice/:id` takes an *invoice* id, and a project may not
 * have one yet. This asks the server to ensure one exists - it raises an
 * invoice for whatever is outstanding, or returns the latest if nothing is -
 * and the model navigates to the result.
 *
 * The decision is server-side on purpose. "Is this invoice current?" means "is
 * there unpaid time it does not already cover", which needs the time table;
 * deciding it in the browser would need every entry and would still race with
 * the tracker syncing.
 */
export const OpenInvoiceLink = ({
  projectId,
  children,
  className,
  style,
  onClick,
  variant = 'inline',
}: {
  projectId: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  /**
   * `inline` carries no chrome of its own - it sits inside a row of text and
   * the call site styles it. `button` reads as a button: ghost background on
   * hover, focus ring, transitions.
   */
  variant?: OpenInvoiceLinkVariant
  /**
   * Runs before the request. Call sites inside a clickable row use it to stop
   * propagation so opening the invoice does not also open the row's own dialog.
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) => {
  const { ensure, pending } = useUnit({
    ensure: ensureInvoiceMutation.start,
    pending: ensureInvoiceMutation.$pending,
  })

  const shared = {
    className,
    style,
    'aria-busy': pending || undefined,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      ensure(projectId)
    },
  }

  if (variant === 'button') {
    return (
      <ButtonRoot variant={'ghost'} color={'neutral'} {...shared}>
        {children}
      </ButtonRoot>
    )
  }

  return (
    <InlineRoot type="button" {...shared}>
      {children}
    </InlineRoot>
  )
}

// Sits inline next to a title rather than in a button row, so it is a little
// more compact than the nominal medium size.
const ButtonRoot = styled(Button)`
  min-height: 28px;
  padding: 0 8px;
`

const InlineRoot = styled.button`
  display: contents;
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: inherit;
`
