import styled from 'styled-components'

export const SectionTitle = styled.h2`
  font-weight: 500;
  font-size: var(--font-size-6);
  line-height: 125%;
  letter-spacing: 0;
  color: var(--ds-neutral-12);
  margin: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--font-size-4);
  }
`
