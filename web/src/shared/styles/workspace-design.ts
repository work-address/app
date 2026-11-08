import { createGlobalStyle } from 'styled-components'

import { workspaceCssTokens } from '../config'

const declarations = Object.entries(workspaceCssTokens)
  .map(([name, value]) => `${name}: ${value};`)
  .join('\n')

/**
 * Where the workspace skin applies: an element marked `data-ui="workspace"`
 * (the app's root Theme) and every Theme Radix renders into a portal, so
 * dialogs, menus and tooltips share the page's design. A portal Theme copies
 * only Radix's own props, never the root's data attributes, hence the second
 * selector.
 */
const SCOPE = `[data-ui='workspace'], .radix-themes[data-is-root-theme='false']`

/** Mount once, beside the root Theme that carries `data-ui="workspace"`. */
export const WorkspaceDesignStyles = createGlobalStyle`
  :root {
    ${declarations}
  }

  ${SCOPE} {
    --default-font-family: var(--ui-font);
    --page-canvas: radial-gradient(ellipse at 70% 0%, var(--ui-glow), var(--ui-canvas) 75%);
    --page-shadow: none;
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

    /* Radix theme colours the scope's form controls and gray text read. */
    --color-surface: var(--ui-surface);
    --gray-a7: var(--ui-line);
    --gray-a10: var(--ui-muted);
    --gray-a11: var(--ui-muted);
    --gray-11: var(--ui-muted);
    --gray-12: var(--ui-text);
    --focus-8: var(--ui-blue);

    /* One field look for every control that takes a value - text fields,
       text areas, tag inputs, selects, date fields, the sort picker and the
       rich editor: a line border on white at the control corner, a stronger
       border on hover, the focus ring outside the edge, red when invalid and
       a pale fill when it cannot be changed. */
    --ui-field-border: var(--ui-line);
    --ui-field-border-hover: var(--ui-line-strong);
    --ui-field-border-invalid: var(--red-9);
    --ui-field-radius: var(--ui-control-radius);
    --ui-field-background: var(--ui-surface);
    --ui-field-background-locked: var(--ui-inset);

    /* Optional hooks on shared primitives; their legacy defaults stay
       everywhere outside this scope. */
    --select-trigger-height: var(--ui-control-height);
    --select-trigger-padding: var(--ui-space-3);
    --select-trigger-radius: var(--ui-field-radius);
    --select-trigger-border: var(--ui-field-border);
    --select-trigger-background: var(--ui-field-background);
    --select-trigger-color: var(--ui-text);
    --select-trigger-font-size: var(--ui-body-size);
    --select-trigger-hover-border: var(--ui-field-border-hover);
    --select-trigger-hover-background: var(--ui-field-background);
    --button-s-height: var(--ui-segment-height);
    --button-s-padding: 0 var(--ui-space-3);
    --button-s-font-size: var(--ui-meta-size);
    --button-s-radius: var(--ui-control-radius);
    --button-m-height: var(--ui-control-height);
    --button-m-padding: 0 var(--ui-space-3);
    --button-m-radius: var(--ui-control-radius);
    --button-l-height: var(--ui-filter-height);
    --button-l-radius: var(--ui-control-radius);
    --button-compact-height: var(--ui-segment-height);
    --button-compact-padding: var(--ui-space-3);
    --button-compact-radius: var(--ui-control-radius);
    --date-field-height: var(--ui-control-height);
    --date-field-radius: var(--ui-field-radius);
    --date-field-padding: var(--ui-space-3);
    --date-field-font-size: var(--ui-body-size);
    --toolbar-gap: var(--ui-space-1);
    --toolbar-padding: var(--ui-space-1);
    --toolbar-border: transparent;
    --toolbar-radius: var(--ui-control-radius);
    --toolbar-background: var(--ui-inset);
    /* A shell's segments fill it to the field height: the control height
       less its padding and border on both sides. */
    --toolbar-segment-height: calc(
      var(--ui-control-height) - 2 * var(--toolbar-padding) - 2 *
        var(--ui-border-width)
    );
    --toolbar-segment-padding: var(--ui-space-3);
    --toolbar-segment-radius: var(--ui-row-radius);
    --toolbar-font-size: var(--ui-meta-size);
    --toolbar-pressed-background: var(--ui-surface);
    --toolbar-pressed-shadow: var(--ui-shadow);
    --sort-select-height: var(--ui-control-height);
    --sort-select-segment-height: var(--toolbar-segment-height);
    --sort-select-radius: var(--ui-field-radius);
    --sort-select-segment-radius: var(--ui-row-radius);
    --sort-select-border: var(--ui-field-border);
    --sort-select-background: var(--ui-field-background);
    --sort-select-font-size: var(--ui-meta-size);
    --sort-select-padding: var(--ui-space-2);
    --table-surface: var(--ui-surface);
    --table-line: var(--ui-line);
    --table-row-border: var(--ui-border-width) solid var(--ui-line);
    --table-row-hover: var(--ui-inset);
    --table-header-font-size: var(--ui-meta-size);
    --table-header-padding-y: var(--ui-space-3);
    --table-cell-padding-y: var(--ui-space-3);
    --table-cell-padding-x: var(--ui-space-3);
    --table-edge-padding: 0px;
    --table-group-padding-top: var(--ui-space-5);
    --table-desktop-fade: 1;
    --table-sort-height: var(--ui-segment-height);
    --table-sort-padding: 0 var(--ui-space-2);
    --table-sort-offset: calc(-1 * var(--ui-space-2)) 0;

    font-family: var(--ui-font);
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-leading);
    color: var(--ui-text);
  }

  /* Paper is white: the canvas and its glow are for the screen. */
  @media print {
    ${SCOPE} {
      --page-canvas: var(--white);
    }
  }

  /* Radix sets these per size on the field itself, so the scope restates
     them there rather than on an ancestor. */
  :is(${SCOPE}) .rt-TextFieldRoot {
    --text-field-height: var(--ui-control-height);
    --text-field-border-radius: var(--ui-control-radius);
    --text-field-padding: calc(var(--ui-space-3) - var(--text-field-border-width));

    font-size: var(--ui-body-size);
    letter-spacing: normal;
  }

  /* Portaled surfaces: the panel corner for dialogs, the control corner for
     menus and popovers. Doubled to outrank Radix's own corner rules. */
  .rt-BaseDialogContent.rt-BaseDialogContent {
    border-radius: var(--ui-radius);
    box-shadow:
      var(--ui-shadow),
      0 0 0 var(--ui-border-width) var(--ui-line);
  }

  .rt-PopoverContent.rt-PopoverContent,
  .rt-BaseMenuContent.rt-BaseMenuContent {
    border-radius: var(--ui-control-radius);
    box-shadow: var(--ui-shadow), 0 0 0 var(--ui-border-width) var(--ui-line);
  }

  /* A 16px box outlined in the pale separator colour all but disappears. */
  :is(${SCOPE}) .rt-CheckboxRoot {
    --gray-a7: var(--ui-line-strong);
  }

  :is(${SCOPE}) .rt-TextAreaRoot {
    border-radius: var(--ui-field-radius);
    font-size: var(--ui-body-size);
    letter-spacing: normal;
  }

  /* Radix draws its fields' border as an inset shadow and its focus ring
     inside the edge; here they take the shared field look, so a text field
     beside a select reads as the same kind of control in every state. */
  :is(${SCOPE}) :is(.rt-TextFieldRoot, .rt-TextAreaRoot) {
    --text-field-border-radius: var(--ui-field-radius);

    background-color: var(--ui-field-background);
    background-image: none;
    box-shadow: inset 0 0 0 var(--ui-border-width) var(--ui-field-border);
  }

  :is(${SCOPE}) :is(.rt-TextFieldRoot, .rt-TextAreaRoot):hover {
    box-shadow: inset 0 0 0 var(--ui-border-width) var(--ui-field-border-hover);
  }

  :is(${SCOPE}) :is(.rt-TextFieldRoot, .rt-TextAreaRoot):focus-within {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }

  :is(${SCOPE})
    :is(.rt-TextFieldRoot, .rt-TextAreaRoot):has(
      :is(.rt-TextFieldInput, .rt-TextAreaInput)[aria-invalid='true']
    ) {
    box-shadow: inset 0 0 0 var(--ui-border-width) var(--ui-field-border-invalid);
  }

  :is(${SCOPE})
    :is(.rt-TextFieldRoot, .rt-TextAreaRoot):has(
      :is(.rt-TextFieldInput, .rt-TextAreaInput):is(:disabled, :read-only)
    ) {
    background-color: var(--ui-field-background-locked);
    box-shadow: inset 0 0 0 var(--ui-border-width) var(--ui-field-border);
  }

  :is(${SCOPE}) .rt-TextAreaInput {
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-line-height);
  }
`
