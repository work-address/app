import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Button } from '../button'

import type { ReactNode } from 'react'

export type StateNoticeTone = 'neutral' | 'error'

type Props = {
  title: ReactNode
  description?: ReactNode
  /** The way on: a retry, a reset, a link elsewhere. */
  actions?: ReactNode
  tone?: StateNoticeTone
  /**
   * `inline` is one line inside a panel, for a minor failure beside working
   * content; `section` sits inside a panel; `panel` stands in for a whole
   * panel on the canvas; `page` is the page.
   */
  size?: 'inline' | 'section' | 'panel' | 'page'
  className?: string
}

/**
 * The one shape for "there is nothing here" and "this did not load": a dashed
 * box with a title, a sentence and a way on. Failures say so in their own
 * words rather than borrowing the empty copy - "no invoices yet" when the
 * truth is "could not load them" sends someone looking for a record they know
 * exists.
 */
export const StateNotice = ({
  title,
  description,
  actions,
  tone = 'neutral',
  size = 'section',
  className,
}: Props) => (
  <Root
    data-tone={tone}
    data-size={size}
    className={className}
    role={tone === 'error' ? 'alert' : undefined}
  >
    {/* A page-size notice is the page, so its title is the page's h1. */}
    <Title as={size === 'page' ? 'h1' : 'h2'}>{title}</Title>
    {description ? <Description>{description}</Description> : null}
    {actions ? <Actions>{actions}</Actions> : null}
  </Root>
)

type LoadFailureProps = {
  /** What did not load, e.g. "Could not load invoices". */
  title?: ReactNode
  description?: ReactNode
  onRetry: () => void
  /**
   * `inline` is one line inside a panel, for a minor failure beside working
   * content; `section` sits inside a panel; `panel` stands in for a whole
   * panel on the canvas; `page` is the page.
   */
  size?: 'inline' | 'section' | 'panel' | 'page'
  className?: string
}

/** A failed request, with the retry that is the obvious way on. */
export const LoadFailure = ({
  title,
  description,
  onRetry,
  size,
  className,
}: LoadFailureProps) => {
  const { t } = useTranslation()

  return (
    <StateNotice
      tone="error"
      size={size}
      className={className}
      title={title ?? t('common.loadFailure.title')}
      description={description ?? t('common.loadFailure.description')}
      actions={
        <Button
          size={size === 'inline' ? 'm' : 'l'}
          variant="outline"
          onClick={onRetry}
        >
          {t('common.loadFailure.retry')}
        </Button>
      }
    />
  )
}

/* Inside a panel, a quiet dashed frame; as the whole page, a white
   workspace panel of its own on the canvas. */
const Root = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-8) var(--ui-space-4);
  text-align: center;
  border: var(--ui-border-width) dashed var(--ui-line);
  border-radius: var(--ui-control-radius);

  /* On the canvas a notice is a white panel of its own, like the panel it
     stands in for. */
  &[data-size='panel'],
  &[data-size='page'] {
    border: var(--ui-border-width) solid var(--ui-edge);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
  }

  /* One line: the words on the left, the way on at the right. */
  &[data-size='inline'] {
    grid-template-columns: minmax(0, 1fr) auto;
    justify-items: start;
    align-items: center;
    column-gap: var(--ui-space-4);
    padding: var(--ui-space-3) var(--ui-space-4);
    text-align: start;
  }

  &[data-size='page'] {
    padding-block: calc(var(--ui-space-9) * 1.5);
    border: var(--ui-border-width) solid var(--ui-edge);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--ui-space-6) var(--ui-space-4);

    &[data-size='page'] {
      padding-block: var(--ui-space-8);
    }

    &[data-size='inline'] {
      padding: var(--ui-space-3);
    }
  }
`

const Title = styled.h2`
  margin: 0;
  font-size: var(--ui-figure-size);
  font-weight: var(--ui-heading-weight);
  line-height: var(--ui-figure-line-height);
  letter-spacing: var(--ui-heading-tracking);
  color: var(--ui-ink);

  ${Root}[data-size='inline'] & {
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-line-height);
    font-weight: var(--ui-weight-semibold);
  }

  ${Root}[data-size='page'] & {
    font-size: var(--ui-title-mobile-size);
    line-height: var(--ui-title-mobile-line-height);
    letter-spacing: var(--ui-title-tracking);
  }
`

const Description = styled.p`
  margin: 0;
  max-width: 440px;
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  color: var(--ui-muted);
  overflow-wrap: anywhere;

  ${Root}[data-size='inline'] & {
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-3);

  ${Root}[data-size='inline'] & {
    grid-column: 2;
    grid-row: 1 / span 2;
    margin-top: 0;
  }
`
