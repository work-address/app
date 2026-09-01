import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

const PLACEHOLDER_TILE_COUNT = 12

/** Holds the grid's shape while the first page is in flight. */
export const TimeGridSkeleton = () => (
  <Root aria-hidden="true">
    {Array.from({ length: PLACEHOLDER_TILE_COUNT }).map((_, index) => (
      <Item key={index}>
        <Media />
        <Line width="70%" />
        <Line width="45%" />
      </Item>
    ))}
  </Root>
)

const Root = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-3);
`

const Item = styled.div`
  display: grid;
  grid-auto-rows: min-content;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--white);
`

const Media = styled(Skeleton)`
  aspect-ratio: 16 / 10;
  width: 100%;
`

const Line = styled(Skeleton)`
  height: 12px;
`
