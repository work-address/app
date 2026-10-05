import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  /** A small status badge or count, set on the title's baseline. */
  badge?: ReactNode
  /** One line of facts or a sentence on what the page is for. */
  description?: ReactNode
  /** Trailing actions or filters; they drop under the title when narrow. */
  actions?: ReactNode
  /** A leading control, such as a back link, on the title's line. */
  leading?: ReactNode
  className?: string
}

/**
 * The one page heading: an `h1` at the same size on every page, an optional
 * badge, a description underneath and actions on the right. Pages that put
 * their title inside a card of their own (a profile, an invoice) use
 * `PageTitle` alone so the size still matches.
 */
export const PageHeader = ({
  title,
  badge,
  description,
  actions,
  leading,
  className,
}: Props) => (
  <Root className={className}>
    <Body>
      <TitleRow>
        {leading}
        <PageTitle>{title}</PageTitle>
        {badge}
      </TitleRow>
      {description ? <Description>{description}</Description> : null}
    </Body>
    {actions ? <Actions>{actions}</Actions> : null}
  </Root>
)

export const PageTitle = styled.h1`
  margin: 0;
  min-width: 0;
  font-size: var(--font-size-7);
  font-weight: 500;
  line-height: 125%;
  letter-spacing: 0;
  color: var(--ds-neutral-12);
  overflow-wrap: anywhere;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--font-size-5);
  }
`

const Root = styled.header`
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3) var(--space-5);
`

const Body = styled.div`
  display: grid;
  gap: var(--space-1);
  min-width: 0;
`

const TitleRow = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--space-2);
  min-width: 0;
`

const Description = styled.p`
  margin: 0;
  font-size: var(--font-size-3);
  line-height: var(--line-height-3);
  color: var(--ds-neutral-11);

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--font-size-2);
    line-height: var(--line-height-2);
  }
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: end;
  gap: var(--space-2);

  /* Under ~560px of header the actions get their own line rather than
     squeezing the title. */
  @container (max-width: 560px) {
    grid-column: 1 / -1;
    justify-content: stretch;
    grid-auto-columns: minmax(0, 1fr);
  }
`
