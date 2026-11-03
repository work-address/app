import styled from 'styled-components'

type Props = {
  label: string
  steps: string[]
}

/** A short numbered list: what's about to happen, in the order it happens. */
export const AuthSteps = ({ label, steps }: Props) => (
  <Root>
    <Label>{label}</Label>
    <List>
      {steps.map((step, index) => (
        <Item key={step}>
          <Badge aria-hidden="true">{index + 1}</Badge>
          <Text>{step}</Text>
        </Item>
      ))}
    </List>
  </Root>
)

const Root = styled.div`
  display: grid;
  gap: var(--space-3);
`

const Label = styled.p`
  margin: 0;
  font-size: var(--font-size-1);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ds-neutral-11);
`

const List = styled.ol`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: var(--space-3);
`

const Badge = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: var(--font-size-1);
  font-weight: 600;
  background: var(--ds-accent-3);
  color: var(--ds-accent-11);
`

const Text = styled.span`
  margin-top: 2px;
  font-size: var(--font-size-2);
  line-height: 20px;
  color: var(--ds-neutral-11);
`
