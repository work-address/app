import styled from 'styled-components'

/**
 * A count or total beside a panel's title ("4 projects", "3h 20m"): the one
 * glow pill every panel uses, so counts read the same wherever they appear.
 * Informational, never a button.
 */
export const WorkspaceCount = styled.span`
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`
