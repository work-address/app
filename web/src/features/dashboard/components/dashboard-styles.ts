import styled from 'styled-components'

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

  ${(p) => p.theme.breakpoints.up('md')} {
    &:has(> :nth-child(2)) {
      grid-template-columns: 1fr 374px;
    }
  }
`

export const Left = styled.section`
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;

  @media (max-width: 1024px) {
    grid-column: 1 / -1;
    padding-right: 8px;
  }
`

export const Right = styled.section`
  min-width: 0;

  @media (max-width: 1024px) {
    display: none;
  }
`

export const Section = styled.section`
  margin-top: 48px;
  margin-bottom: 48px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    margin-bottom: 0;
  }
`

export const SectionTitle = styled.h2`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0;
  color: #1c2024;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 18px;
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
  font-size: 14px;
  line-height: 14px;
  color: #1c2024;
  font-weight: 500;
`
