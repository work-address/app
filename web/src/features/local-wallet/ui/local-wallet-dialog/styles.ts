import styled from 'styled-components'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`

/* Back stays small and the step's own action takes the rest of the row. */
export const Actions = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  margin-top: var(--space-2);
`

export const Notice = styled.div`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--amber-a3);
  color: var(--amber-11);
  font-size: var(--font-size-2);
  line-height: 1.45;
`

/* On white, with an edge of its own, so it reads as a value on a tinted panel
   as well as in a dialog. */
export const Address = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-2);
  background: var(--white);
  overflow-wrap: anywhere;
`

export const ConfirmRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);

  label {
    cursor: pointer;
  }
`

/* A question and the way out of it, on one centred line. */
export const Prompt = styled.p`
  margin: 0;
  text-align: center;
  font-size: var(--font-size-2);
  line-height: 20px;
  color: var(--ds-neutral-11);
`

export const TextAction = styled.button`
  padding: 0;
  font: inherit;
  font-weight: 500;
  color: var(--ds-accent-11);
  cursor: pointer;

  &:hover:not(:disabled) {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
    border-radius: 2px;
  }
`

/* The things someone rarely does, kept apart from signing in. */
export const MoreActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--ds-neutral-alpha-6);
`
