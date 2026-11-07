import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  title: string
  eyebrow?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** The route title and trailing tools, stacked when their columns need room. */
export const WorkspacePageHeader = ({
  title,
  eyebrow,
  description,
  actions,
  className,
}: Props) => (
  <Root className={className}>
    <Heading>
      {eyebrow ? <Caption>{eyebrow}</Caption> : null}
      <Title>{title}</Title>
      {description ? <Description>{description}</Description> : null}
    </Heading>
    {actions}
  </Root>
)

const Root = styled.header`
  display: grid;
  align-items: start;
  gap: var(--ui-section-gap);

  ${(p) => p.theme.breakpoints.up('xl')} {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`

const Heading = styled.div`
  display: grid;
  justify-items: start;
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

const Title = styled.h1`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-title-size);
  line-height: var(--ui-title-line-height);
  font-weight: var(--ui-title-weight);
  letter-spacing: var(--ui-title-tracking);

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-title-mobile-size);
    line-height: var(--ui-title-mobile-line-height);
  }
`

const Description = styled.p`
  margin: 0;
  max-inline-size: var(--ui-description-measure);
  color: var(--ui-muted);
  font-size: var(--ui-description-size);
  line-height: var(--ui-description-line-height);

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }
`
