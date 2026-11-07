import styled from 'styled-components'

/**
 * A white workspace surface without a header: a form section or a document
 * part that names itself inside. WorkspacePanel is the titled version.
 */
export const WorkspaceSheet = styled.section`
  display: grid;
  gap: var(--ui-space-4);
  min-width: 0;
  padding: var(--ui-card-inset);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--ui-card-inset-mobile);
  }
`
