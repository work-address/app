import styled from 'styled-components'

export type ChartLegendItem = { label: string; color: string }

/** Names every series beside its swatch, so identity never rests on colour. */
export const ChartLegend = ({ items }: { items: ChartLegendItem[] }) =>
  items.length < 2 ? null : (
    <Root>
      {items.map((item) => (
        <Item key={item.label}>
          <Swatch style={{ background: item.color }} />
          <Name title={item.label}>{item.label}</Name>
        </Item>
      ))}
    </Root>
  )

const Root = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 220px;
`

const Swatch = styled.span`
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
`

const Name = styled.span`
  overflow: hidden;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  white-space: nowrap;
  text-overflow: ellipsis;
`
