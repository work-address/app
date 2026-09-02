import styled from 'styled-components'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);

  ${(p) => p.theme.breakpoints.down('md')} {
    & > * {
      flex: 1;
    }
  }
`

export const Notice = styled.div`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--amber-a3);
  color: var(--amber-11);
  font-size: var(--font-size-2);
  line-height: 1.45;
`

export const Address = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
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

export const Links = styled.div`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
`

export const LinkButton = styled.button`
  padding: 0;
  font-size: var(--font-size-2);
  color: var(--ds-accent-11);
  text-decoration: underline;
  text-underline-offset: 2px;

  &[data-danger] {
    color: var(--error-11);
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
