import styled from 'styled-components'

import { TimeDayHeading } from '../common'

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
  gap: var(--space-3);
`

const Header = styled(TimeDayHeading)`
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--ds-neutral-alpha-6);
`

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-3);
`
