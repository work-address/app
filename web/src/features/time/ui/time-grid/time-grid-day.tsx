import styled from 'styled-components'

import { TimeDayHeading } from '../common'

import { TILE_MIN_WIDTH } from './time-grid-skeleton'
import { TimeGridTile } from './time-grid-tile'

import type { TimeDayGroup } from '../../model'
import type { Time } from '@/entities/time'

type Props = {
  group: TimeDayGroup
  selectedIds: Record<string, boolean>
  onOpen: (entry: Time) => void
  onSelectedChange: (id: string) => void
}

export const TimeGridDay = ({
  group,
  selectedIds,
  onOpen,
  onSelectedChange,
}: Props) => (
  <Root>
    <Header group={group} />
    <List>
      {group.entries.map((entry) => (
        <TimeGridTile
          key={entry.id}
          entry={entry}
          selected={(entry.id && selectedIds[entry.id]) || false}
          onOpen={onOpen}
          onSelectedChange={onSelectedChange}
        />
      ))}
    </List>
  </Root>
)

const Root = styled.section`
  display: grid;
  gap: var(--ui-space-4);
`

const Header = styled(TimeDayHeading)`
  padding-bottom: var(--ui-space-2);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
`

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${TILE_MIN_WIDTH}px, 1fr));
  gap: var(--ui-space-4);

  /* Two across on a phone: a tile is mostly its screenshot, and one 16:10
     tile per row made a day of entries a dozen screens long. The narrowest
     phones take one, so the time range and project stay readable. */
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-3);
  }

  ${(p) => p.theme.breakpoints.down('sm')} {
    grid-template-columns: minmax(0, 1fr);
  }
`
