import { Grid } from '@radix-ui/themes'
import { TextArea as RadixTextArea, Text } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import { Hint } from './hint'

import type { TextAreaProps as RadixTextAreaProps } from '@radix-ui/themes'

type TextAreaProps = RadixTextAreaProps & {
  label?: string
  /** Explains the label in a question-mark tooltip beside it. */
  hint?: string
  value?: string
  id?: string
  state?: 'error' | 'valid'
}

const LABEL_WITH_HINT = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
} as const

export const TextArea = ({
  label,
  hint,
  id,
  state,
  size,
  ...props
}: TextAreaProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const errorProps: TextAreaProps | null =
    state === 'error' ? { color: 'red', variant: 'soft' } : null

  return (
    <Grid
      columns={{ initial: '1' }}
      gap={isUpMd ? 'var(--space-3)' : 'var(--space-2)'}
      align={'center'}
    >
      <Text
        as={'label'}
        size={'2'}
        weight={'medium'}
        htmlFor={id}
        style={hint ? LABEL_WITH_HINT : undefined}
      >
        {label}
        {hint && <Hint content={hint} size={13} />}
      </Text>
      {/* Same responsive default as Input, so a textarea and the fields
          around it share one scale: Radix size 2 on desktop, 3 on phones. */}
      <RadixTextArea
        id={id}
        size={size ?? (isUpMd ? undefined : '3')}
        {...props}
        {...errorProps}
      />
    </Grid>
  )
}
