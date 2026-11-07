export const BUTTON_SIZES = ['s', 'm', 'l'] as const
export const BUTTON_VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const
export const BUTTON_COLORS = ['primary', 'neutral', 'danger'] as const

export type ButtonSize = (typeof BUTTON_SIZES)[number]
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]
export type ButtonColor = (typeof BUTTON_COLORS)[number]

export const BUTTON_SPINNER_SIZE: Record<ButtonSize, number> = {
  s: 12,
  m: 15,
  l: 15,
}

export type ButtonSizeSpec = {
  height: string
  padding: string
  gap: string
  fontSize: string
  borderRadius: string
}

export type ButtonToneSpec = {
  background: string
  color: string
  borderColor?: string
  hover: {
    background?: string
    filter?: string
  }
}

export const BUTTON_DEFAULTS = {
  size: 'm',
  variant: 'solid',
  color: 'primary',
  type: 'button',
} as const satisfies {
  size: ButtonSize
  variant: ButtonVariant
  color: ButtonColor
  type: 'button'
}

/**
 * Each value reads an optional `--button-<size>-*` hook first, so a design
 * scope can restate the geometry without touching the default elsewhere.
 */
export const BUTTON_SIZE_SPECS: Record<ButtonSize, ButtonSizeSpec> = {
  s: {
    height: 'var(--button-s-height, 24px)',
    padding: 'var(--button-s-padding, 0 8px)',
    gap: '4px',
    fontSize: 'var(--button-s-font-size, 12px)',
    borderRadius: 'var(--button-s-radius, 4px)',
  },
  m: {
    height: 'var(--button-m-height, 32px)',
    padding: 'var(--button-m-padding, 0 12px)',
    gap: '8px',
    fontSize: '14px',
    borderRadius: 'var(--button-m-radius, 6px)',
  },
  l: {
    height: 'var(--button-l-height, 40px)',
    padding: '0 16px',
    gap: '8px',
    fontSize: '16px',
    borderRadius: 'var(--button-l-radius, 6px)',
  },
}

export const BUTTON_TONE_SPECS: Record<
  ButtonColor,
  Record<ButtonVariant, ButtonToneSpec>
> = {
  primary: {
    solid: {
      background: 'var(--ui-blue)',
      color: 'var(--ui-surface)',
      hover: { background: 'var(--ui-blue)' },
    },
    soft: {
      background: 'var(--ui-glow)',
      color: 'var(--ui-blue)',
      hover: { filter: 'brightness(0.95)' },
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--ui-alpha-6)',
      color: 'var(--ui-blue)',
      hover: { background: 'var(--ui-glow)' },
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ui-blue)',
      hover: { background: 'var(--ui-glow)' },
    },
  },
  neutral: {
    solid: {
      background: 'var(--ui-ink)',
      color: 'var(--ui-surface)',
      hover: { filter: 'brightness(1.1)' },
    },
    soft: {
      background: 'var(--ui-inset)',
      color: 'var(--ui-muted)',
      hover: { filter: 'brightness(0.95)' },
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--ui-line-strong)',
      color: 'var(--ui-ink)',
      hover: { background: 'var(--ui-inset)' },
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ui-muted)',
      hover: { background: 'var(--ui-inset)' },
    },
  },
  danger: {
    solid: {
      background: 'var(--red-9)',
      color: 'var(--ui-surface)',
      hover: { filter: 'brightness(0.92)' },
    },
    soft: {
      background: 'var(--ui-inset)',
      color: 'var(--error-11)',
      hover: { filter: 'brightness(0.95)' },
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--error-alpha-6)',
      color: 'var(--error-11)',
      hover: { background: 'var(--red-a2)' },
    },
    ghost: {
      background: 'transparent',
      color: 'var(--error-11)',
      hover: { background: 'var(--red-a2)' },
    },
  },
}
