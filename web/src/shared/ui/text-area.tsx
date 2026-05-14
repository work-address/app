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

export const TextArea = ({ label, id, state, ...props }: TextAreaProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const errorProps: TextAreaProps | null =
    state === 'error' ? { color: 'red', variant: 'soft' } : null

  return (
    <Grid
      columns={{ initial: '1' }}
      gap={isUpMd ? '12px' : 'var(--space-2)'}
      align={'center'}
    >
      <Text as={'label'} size={'2'} weight={'medium'} htmlFor={id}>
        {label}
      </Text>

      <RadixTextArea id={id} size={'3'} {...props} {...errorProps} />
    </Grid>
  )
}
