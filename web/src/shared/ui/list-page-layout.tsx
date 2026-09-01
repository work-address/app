import styled from 'styled-components'

export { SectionTitle } from './section-title'

export const TopRight = styled.div`
  margin-left: auto;
`

export const TableArea = styled.div`
  padding-top: 4px;
  flex: 1 0 auto;
`

export const Content = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
  /* Keeps the worklogs section from crowding the projects card below it. */
  margin-bottom: 32px;

  ${(p) => p.theme.breakpoints.up('md')} {
    &:has(> :nth-child(2)) {
      grid-template-columns: 1fr 374px;
    }
  }
`

export const Main = styled.section`
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;

  ${(p) => p.theme.breakpoints.down('lg')} {
    grid-column: 1 / -1;
    padding-right: 8px;
  }
`

export const Aside = styled.section`
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('lg')} {
    display: none;
  }
`

export const Section = styled.section`
  margin-bottom: 48px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-bottom: 0;
  }
`

export const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`

export const FilterImage = styled.img`
  width: 16px;
  height: 16px;
  display: block;
`

export const Field = styled.div<{ $basis?: number }>`
  ${(p) => p.$basis && `flex-basis: ${p.$basis}px;`}
`

export const Label = styled.div`
  font-size: var(--font-size-2);
  line-height: 14px;
  color: var(--ds-neutral-12);
  font-weight: 500;
`
