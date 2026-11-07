import { createGlobalStyle } from 'styled-components'

import { workspaceCssTokens } from '../config'

const declarations = Object.entries(workspaceCssTokens)
  .map(([name, value]) => `${name}: ${value};`)
  .join('\n')

/** Mount once. Only an explicitly opted-in route receives the workspace skin. */
export const WorkspaceDesignStyles = createGlobalStyle`
  :root {
    ${declarations}
  }

  [data-ui='workspace'] {
    --default-font-family: var(--ui-font);
    --page-canvas: radial-gradient(ellipse at 70% 0%, var(--ui-glow), var(--ui-canvas) 75%);
    --page-shadow: none;
    --page-scroll-mask: none;
    --sidebar-bg: var(--ui-canvas);
    --sidebar-border: var(--ui-line);
    --sidebar-padding: var(--ui-space-5) var(--ui-space-3) var(--ui-space-3);
    --sidebar-gap: var(--ui-space-5);
    --sidebar-item-gap: var(--ui-space-2);
    --sidebar-item-height: var(--ui-filter-height);
    --sidebar-item-radius: var(--ui-icon-radius);
    --sidebar-item-font-size: var(--ui-body-size);
    --sidebar-item-color: var(--ui-muted);
    --sidebar-item-hover: var(--ui-inset);
    --sidebar-item-hover-color: var(--ui-ink);
    --sidebar-item-active-bg: var(--ui-surface);
    --sidebar-item-active-shadow: var(--ui-shadow);
    --sidebar-item-active-color: var(--ui-blue);
    --sidebar-item-active-weight: var(--ui-weight-semibold);
    --sidebar-item-muted-color: var(--ui-muted);
    --sidebar-edge-width: var(--ui-border-width);
    --ds-neutral-2: var(--ui-inset);
    --ds-neutral-4: var(--ui-line);
    --ds-neutral-9: var(--ui-muted);
    --ds-neutral-11: var(--ui-muted);
    --ds-neutral-12: var(--ui-ink);
    --ds-neutral-alpha-3: var(--ui-alpha-3);
    --ds-neutral-alpha-4: var(--ui-alpha-4);
    --ds-neutral-alpha-5: var(--ui-alpha-5);
    --ds-neutral-alpha-6: var(--ui-alpha-6);
    --ds-accent-3: var(--ui-glow);
    --ds-accent-9: var(--ui-blue);
    --ds-accent-11: var(--ui-blue);
    --color-panel-solid: var(--ui-surface);
    font-family: var(--ui-font);
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-leading);
    color: var(--ui-text);
  }
`
