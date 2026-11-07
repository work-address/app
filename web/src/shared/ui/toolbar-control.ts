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
  gap: var(--toolbar-gap, 2px);
  padding: var(--toolbar-padding, 2px);
  border: 1px solid var(--toolbar-border, var(--ui-line));
  border-radius: var(--toolbar-radius, var(--ui-filter-radius));
  background: var(--toolbar-background, var(--ui-inset));
`

/** One pressable region inside the shell. */
export const ToolbarSegment = styled.button`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-1);
  min-height: var(--toolbar-segment-height, 22px);
  padding: var(--ui-space-1) var(--toolbar-segment-padding, var(--ui-space-3));
  border-radius: var(--toolbar-segment-radius, var(--ui-row-radius));
  font-size: var(--toolbar-font-size, var(--ui-small-size));
  line-height: 1;
  white-space: nowrap;
  color: var(--ui-muted);
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    color: var(--ui-ink);
  }

  /* Pressed for the toggle, open for the dropdown - the same "this one is
     current" state, expressed by whichever primitive owns it. */
  &[aria-pressed='true'],
  &[data-state='open'] {
    background: var(--toolbar-pressed-background, var(--ui-surface));
    color: var(--ui-ink);
    box-shadow: var(--toolbar-pressed-shadow, 0 0 0 1px var(--ui-line));
  }

  &:focus-visible {
    outline: 2px solid var(--ui-blue);
    outline-offset: 2px;
  }
`
