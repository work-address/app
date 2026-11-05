import styled from 'styled-components'

/**
 * One band of a full-width page: a hairline on top and no box around it, so
 * its content lines up with the page's own edge.
 */
export const PageSection = styled.section`
  padding-block: var(--space-5);
  border-top: 1px solid var(--ds-neutral-alpha-6);
`
