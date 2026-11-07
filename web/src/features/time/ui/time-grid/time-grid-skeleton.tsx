import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

const PLACEHOLDER_TILE_COUNT = 12

/** The narrowest a tile gets before the row takes one fewer. */
export const TILE_MIN_WIDTH = 220

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
  grid-template-columns: repeat(auto-fill, minmax(${TILE_MIN_WIDTH}px, 1fr));
  gap: var(--ui-space-4);

  /* The same columns as the grid it stands in for. */
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-3);
  }

  ${(p) => p.theme.breakpoints.down('sm')} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Item = styled.div`
  display: grid;
  grid-auto-rows: min-content;
  gap: var(--ui-space-2);
  padding-bottom: var(--ui-space-3);
  border: var(--ui-border-width) solid var(--ui-line);
  border-radius: var(--ui-control-radius);
  background: var(--ui-surface);
  overflow: hidden;
`

const Media = styled(Skeleton)`
  aspect-ratio: 16 / 10;
  width: 100%;
  border-radius: 0;
`

const Line = styled(Skeleton)`
  height: var(--ui-space-3);
  margin-inline: var(--ui-space-3);
`
