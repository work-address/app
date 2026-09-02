import { Grid } from '@radix-ui/themes'
import { TextArea as RadixTextArea, Text } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import type { TextAreaProps as RadixTextAreaProps } from '@radix-ui/themes'

type TextAreaProps = RadixTextAreaProps & {
  label?: string
  value?: string
  id?: string
  state?: 'error' | 'valid'
}

export const TextArea = ({
  label,
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
      <Text as={'label'} size={'2'} weight={'medium'} htmlFor={id}>
        {label}
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
