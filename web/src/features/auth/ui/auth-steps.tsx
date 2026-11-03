import styled from 'styled-components'

export type AuthStep = {
  title?: string
  text: string
}

type Props = {
  label: string
  steps: AuthStep[]
  /** `row` sets the steps side by side as equal tiles, for a wide band. */
  layout?: 'column' | 'row'
  className?: string
}

/** A short numbered list: what's about to happen, in the order it happens. */
export const AuthSteps = ({
  label,
  steps,
  layout = 'column',
  className,
}: Props) => (
  <Root className={className}>
    <Label>{label}</Label>
    <List data-layout={layout}>
      {steps.map((step, index) => (
        <Item key={step.text}>
          <Badge aria-hidden="true">{index + 1}</Badge>
          {step.title && <Title>{step.title}</Title>}
          <Text>{step.text}</Text>
        </Item>
      ))}
    </List>
  </Root>
)

/* A parent sets these to put the steps on another surface. */
const Root = styled.div`
  --steps-label: var(--ds-neutral-11);
  --steps-title: var(--ds-neutral-12);
  --steps-text: var(--ds-neutral-11);
  --steps-badge-bg: var(--ds-accent-3);
  --steps-badge-fg: var(--ds-accent-11);
  --steps-tile-bg: var(--ds-neutral-2);
  --steps-tile-border: var(--ds-neutral-alpha-6);

  display: grid;
  gap: var(--space-3);
`

const Label = styled.p`
  margin: 0;
  font-size: var(--font-size-1);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--steps-label);
`

const List = styled.ol`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;

  &[data-layout='row'] {
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
  }
`

const Item = styled.li`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-content: start;
  gap: 2px var(--space-3);

  ${List}[data-layout='row'] & {
    padding: var(--space-3);
    border: 1px solid var(--steps-tile-border);
    border-radius: var(--radius-3);
    background: var(--steps-tile-bg);
  }
`

const Badge = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: var(--font-size-1);
  font-weight: 600;
  background: var(--steps-badge-bg);
  color: var(--steps-badge-fg);
`

const Title = styled.span`
  font-size: var(--font-size-2);
  font-weight: 600;
  line-height: 24px;
  color: var(--steps-title);
`

const Text = styled.span`
  grid-column: 2;
  margin-top: 2px;
  font-size: var(--font-size-2);
  line-height: 20px;
  color: var(--steps-text);

  ${List}[data-layout='row'] & {
    grid-column: 1 / -1;
    margin-top: var(--space-1);
  }
`
