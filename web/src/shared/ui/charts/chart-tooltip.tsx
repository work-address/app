import styled from 'styled-components'

import type { ReactNode } from 'react'

export type ChartTooltipLayout = 'vertical' | 'horizontal'

export type ChartTooltipRow = {
  label: string
  value: string
  color?: string
}

/** What a chart says about the point under the pointer. */
export type ChartTooltipContent = {
  /** Defaults to the chart's own title for the point. */
  title?: string
  rows: ChartTooltipRow[]
  sections?: { title: string; rows: ChartTooltipRow[] }[]
  note?: string
}

type Props = {
  title: ReactNode
  rows: ChartTooltipRow[]
  total?: { label: string; value: string }
  empty?: string
  /** One closing line in muted ink, such as what makes this point stand out. */
  note?: string
  /** Named groups of rows after the main ones, such as a breakdown. */
  sections?: { title: string; rows: ChartTooltipRow[] }[]
  /**
   * Vertical stacks the sections under the rows; horizontal sets them side by
   * side as columns, for a breakdown too long to read top to bottom.
   */
  layout?: ChartTooltipLayout
  /**
   * Plain drops the card's own border, shadow and padding, for content shown
   * inside a panel that already has them, such as a hover card.
   */
  variant?: 'card' | 'plain'
}

/**
 * The card every dashboard chart shows on hover: a title, one row per series
 * with its swatch, and an optional total. Values are in ink, never in the
 * series colour.
 */
export const ChartTooltip = ({
  title,
  rows,
  total,
  empty,
  note,
  sections,
  layout = 'vertical',
  variant = 'card',
}: Props) => (
  <Root role="tooltip" data-layout={layout} data-variant={variant}>
    <Title>{title}</Title>
    <Body>
      {rows.length === 0 && empty ? <Muted>{empty}</Muted> : null}
      {rows.length > 0 && (
        <Column>
          <Rows rows={rows} />
          {total ? (
            <Total>
              <Muted>{total.label}</Muted>
              <Value>{total.value}</Value>
            </Total>
          ) : null}
        </Column>
      )}
      {sections
        ?.filter((section) => section.rows.length > 0)
        .map((section) => (
          <Section key={section.title}>
            <SectionTitle>{section.title}</SectionTitle>
            <Rows rows={section.rows} />
          </Section>
        ))}
    </Body>
    {note ? <Note>{note}</Note> : null}
  </Root>
)

const Rows = ({ rows }: { rows: ChartTooltipRow[] }) => (
  <List>
    {/* Labels can repeat (several workers), so the index keeps keys apart. */}
    {rows.map((row, index) => (
      <Row key={`${index}:${row.label}`}>
        <Label>
          {row.color ? <Swatch style={{ background: row.color }} /> : null}
          <LabelText>{row.label}</LabelText>
        </Label>
        <Value>{row.value}</Value>
      </Row>
    ))}
  </List>
)

const Root = styled.div`
  min-width: 180px;
  max-width: 320px;

  &[data-layout='horizontal'] {
    max-width: none;
  }

  &[data-variant='plain'] {
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
  }

  /* Fill the popup a parent sized for its columns. */
  [data-wide] > & {
    width: 100%;
  }

  padding: 8px 10px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: 10px;
  background: var(--color-panel-solid);
  box-shadow: 0 1px 6px var(--c-rgba-0-0-0-0_08);
  color: var(--ds-neutral-12);
  pointer-events: none;
`

const Title = styled.div`
  padding-bottom: 6px;
  font-size: var(--font-size-2);
  font-weight: 600;
  line-height: 20px;
`

/* Rows and sections: one under another, or side by side as columns that
   wrap onto a new line when the popup is narrow. */
const Body = styled.div`
  display: grid;
  gap: 8px;

  ${Root}[data-layout='horizontal'] & {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px 16px;
  }
`

/* Columns shrink to their share rather than to their longest value, so a
   long label ellipsises instead of running into the next column. */
const Column = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  min-width: 0;
`

/* A zero-minimum track, so each row takes the column's width rather than
   its content's, and its label and value shrink to fit. */
const List = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`

const Label = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-2);
  white-space: nowrap;
  text-overflow: ellipsis;
`

/* Its own box so it can shrink below its text and ellipsise; as a bare
   text node in the flex label it would hold its full width and push the
   value out of the column. */
const LabelText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Swatch = styled.span`
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
`

/* Holds its width before the label gives way, but never more than most of
   the row: a long value ellipsises rather than leave its column. */
const Value = styled.span`
  flex: 0 0 auto;
  min-width: 0;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-2);
  white-space: nowrap;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const Muted = styled.span`
  color: var(--ds-neutral-11);
  font-size: var(--font-size-2);
`

const Total = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ds-neutral-alpha-5);
`

const Note = styled.p`
  margin: 8px 0 0;
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
`

const Section = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 6px;
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid var(--ds-neutral-alpha-5);

  /* Columns are kept apart by the gap alone: a divider would stay on a
     section that wraps to the start of a new line. */
  ${Root}[data-layout='horizontal'] & {
    padding-top: 0;
    border-top: 0;
  }
`

const SectionTitle = styled.div`
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  font-weight: 500;
`
