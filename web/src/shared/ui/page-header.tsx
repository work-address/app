import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  /** A short line of context above the title. */
  eyebrow?: ReactNode
  title: ReactNode
  /** A small status badge or count, set on the title's baseline. */
  badge?: ReactNode
  /** One line of facts or a sentence on what the page is for. */
  description?: ReactNode
  /** Trailing actions or filters; they drop under the title when narrow. */
  actions?: ReactNode
  /**
   * Where the actions sit beside a tall heading: `start` by the title, or
   * `end` on the description's line.
   */
  actionsAlign?: 'start' | 'end'
  /** A leading control, such as a back link, on the title's line. */
  leading?: ReactNode
  className?: string
}

/**
 * The one page heading: an `h1` at the same size on every page, an optional
 * badge, a description underneath and actions on the right. Pages that put
 * their title inside a band of their own (a profile, an invoice) use
 * `PageTitle` alone so the size still matches.
 */
export const PageHeader = ({
  eyebrow,
  title,
  badge,
  description,
  actions,
  actionsAlign = 'start',
  leading,
  className,
}: Props) => (
  <Root className={className}>
    <Body>
      {eyebrow ? <Caption>{eyebrow}</Caption> : null}
      <TitleRow>
        {leading}
        <PageTitle>{title}</PageTitle>
        {badge}
      </TitleRow>
      {description ? <Description>{description}</Description> : null}
    </Body>
    {actions ? <Actions data-align={actionsAlign}>{actions}</Actions> : null}
  </Root>
)

export const PageTitle = styled.h1`
  margin: 0;
  min-width: 0;
  font-size: var(--ui-title-size);
  font-weight: var(--ui-title-weight);
  line-height: var(--ui-title-line-height);
  letter-spacing: var(--ui-title-tracking);
  color: var(--ui-ink);
  overflow-wrap: anywhere;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-title-mobile-size);
    line-height: var(--ui-title-mobile-line-height);
  }
`

const Root = styled.header`
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--ui-space-3) var(--ui-section-gap);
`

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-2);
  min-width: 0;
`

const Caption = styled.p`
  margin: 0 0 var(--ui-space-1);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  font-weight: var(--ui-eyebrow-weight);
  letter-spacing: var(--ui-eyebrow-tracking);
  text-transform: uppercase;
`

const TitleRow = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--ui-space-3);
  min-width: 0;
`

const Description = styled.div`
  margin: 0;
  max-inline-size: var(--ui-description-measure);
  font-size: var(--ui-description-size);
  line-height: var(--ui-description-line-height);
  color: var(--ui-muted);

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: end;
  gap: var(--ui-space-3);

  &[data-align='end'] {
    align-self: end;
  }

  /* Under ~560px of header the actions get their own line rather than
     squeezing the title. */
  @container (max-width: 560px) {
    grid-column: 1 / -1;
    justify-content: stretch;
    grid-auto-columns: minmax(0, 1fr);
  }
`
