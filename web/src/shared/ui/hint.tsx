import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import styled from 'styled-components'

import { Tooltip } from './tooltip'

export type HintProps = {
  content: string
  className?: string
  size?: number
}

/**
 * The question-mark affordance beside a label whose meaning the label alone
 * does not carry - the tracked metrics, mostly, where "Mouse" could equally
 * mean clicks, distance or time.
 *
 * A focusable `span` rather than a `button`: hints sit inside sortable table
 * headers and form labels, both of which are already interactive elements, and
 * a nested button is invalid HTML. `tabIndex` is still needed because Radix
 * opens on focus as well as hover, which is the only route to the description
 * for a keyboard user.
 */
export const Hint = ({ content, className, size = 14 }: HintProps) => (
  <Tooltip content={content}>
    <Root className={className} role="img" aria-label={content} tabIndex={0}>
      <QuestionMarkCircledIcon width={size} height={size} />
    </Root>
  </Tooltip>
)

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--ds-neutral-9);
  cursor: help;

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
    border-radius: 50%;
  }

  /* An affordance for hovering, which paper does not do - and the invoice
     summary prints straight to PDF. */
  @media print {
    display: none;
  }
`
