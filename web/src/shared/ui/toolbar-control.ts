import styled from 'styled-components'

/**
 * The shell the worklogs header controls share.
 *
 * One definition rather than one per control: the view toggle and the sort
 * picker sit side by side, so any difference in height, radius or type size
 * reads as a mistake. Consumers extend these with `styled()` rather than
 * restating the recipe.
 */
export const ToolbarShell = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--ds-neutral-2);
`

/** One pressable region inside the shell. */
export const ToolbarSegment = styled.button`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: 22px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-2);
  font-size: var(--font-size-1);
  line-height: 1;
  white-space: nowrap;
  color: var(--ds-neutral-11);
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    color: var(--ds-neutral-12);
  }

  /* Pressed for the toggle, open for the dropdown - the same "this one is
     current" state, expressed by whichever primitive owns it. */
  &[aria-pressed='true'],
  &[data-state='open'] {
    background: var(--white);
    color: var(--ds-neutral-12);
    box-shadow: 0 0 0 1px var(--ds-neutral-alpha-6);
  }
`
