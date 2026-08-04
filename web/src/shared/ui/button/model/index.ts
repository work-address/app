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

export const BUTTON_SIZE_SPECS: Record<ButtonSize, ButtonSizeSpec> = {
  s: {
    height: '24px',
    padding: '0 8px',
    gap: '4px',
    fontSize: '12px',
    borderRadius: '4px',
  },
  m: {
    height: '32px',
    padding: '0 12px',
    gap: '8px',
    fontSize: '14px',
    borderRadius: '6px',
  },
  l: {
    height: '40px',
    padding: '0 16px',
    gap: '8px',
    fontSize: '16px',
    borderRadius: '6px',
  },
}

export const BUTTON_TONE_SPECS: Record<
  ButtonColor,
  Record<ButtonVariant, ButtonToneSpec>
> = {
  primary: {
    solid: {
      background: 'var(--ds-accent-11)',
      color: 'var(--white)',
      hover: { background: 'var(--ds-accent-9)' },
    },
    soft: {
      background: 'var(--ds-accent-3)',
      color: 'var(--ds-accent-11)',
      hover: { filter: 'brightness(0.97)' },
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--ds-accent-alpha-6)',
      color: 'var(--ds-accent-11)',
      hover: { background: 'var(--ds-accent-3)' },
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ds-accent-11)',
      hover: { background: 'var(--ds-accent-3)' },
    },
  },
  neutral: {
    solid: {
      background: 'var(--ds-neutral-12)',
      color: 'var(--white)',
      hover: { filter: 'brightness(1.1)' },
    },
    soft: {
      background: 'var(--ds-secondary)',
      color: 'var(--ds-neutral-11)',
      hover: { filter: 'brightness(0.97)' },
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--ds-neutral-alpha-8)',
      color: 'var(--ds-neutral-12)',
      hover: { background: 'var(--ds-neutral-alpha-3)' },
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ds-neutral-11)',
      hover: { background: 'var(--ds-neutral-alpha-3)' },
    },
  },
  danger: {
    solid: {
      background: 'var(--c-e5484d)',
      color: 'var(--white)',
      hover: { filter: 'brightness(0.98)' },
    },
    soft: {
      background: 'var(--ds-secondary)',
      color: 'var(--error-11)',
      hover: { filter: 'brightness(0.97)' },
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--error-alpha-6)',
      color: 'var(--error-11)',
      hover: { background: 'var(--c-rgba-210-0-5-0_06)' },
    },
    ghost: {
      background: 'transparent',
      color: 'var(--error-11)',
      hover: { background: 'var(--c-rgba-210-0-5-0_06)' },
    },
  },
}
