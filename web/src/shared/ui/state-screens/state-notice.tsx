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
  /** `section` sits inside a page among other blocks; `page` is the page. */
  size?: 'section' | 'page'
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
  size?: 'section' | 'page'
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
        <Button size="l" variant="outline" onClick={onRetry}>
          {t('common.loadFailure.retry')}
        </Button>
      }
    />
  )
}

const Root = styled.div`
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
  border: 1px dashed var(--gray-a6);
  border-radius: var(--radius-3);

  &[data-size='page'] {
    padding-block: calc(var(--space-9) * 1.5);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--space-6) var(--space-4);
  }
`

const Title = styled.h2`
  margin: 0;
  font-size: var(--font-size-4);
  font-weight: 500;
  line-height: var(--line-height-4);
  color: var(--ds-neutral-12);

  ${Root}[data-size='page'] & {
    font-size: var(--font-size-6);
    line-height: var(--line-height-6);
  }
`

const Description = styled.p`
  margin: 0;
  max-width: 440px;
  font-size: var(--font-size-3);
  line-height: var(--line-height-3);
  color: var(--ds-neutral-11);
  overflow-wrap: anywhere;
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
`
