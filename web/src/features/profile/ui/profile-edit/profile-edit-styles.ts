import styled from 'styled-components'

/** The heading of each section of the profile form. */
export const SectionHeading = styled.h2`
  margin: 0;
  font-size: var(--font-size-5);
  font-weight: 500;
  line-height: var(--line-height-5);
  color: var(--ds-neutral-12);

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--font-size-4);
    line-height: var(--line-height-4);
  }
`
