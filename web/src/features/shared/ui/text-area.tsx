import { Grid } from '@radix-ui/themes'
import { TextArea as RadixTextArea, Text } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import type { TextAreaProps as RadixTextAreaProps } from '@radix-ui/themes'

type TextAreaProps = RadixTextAreaProps & {
  label?: string
  value?: string
  id?: string
  labelWidth?: string
}

export const TextArea = ({
  label,
  id,
  labelWidth = 'auto',
  ...props
}: TextAreaProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return (
    <Grid
      columns={{ initial: '1', sm: `${labelWidth} 1fr` }}
      gap={isUpMd ? '24px' : 'var(--space-2)'}
      align={'center'}
    >
      <Text as={'label'} size={'2'} weight={'medium'} htmlFor={id}>
        {label}
      </Text>

      <RadixTextArea id={id} {...props} />
    </Grid>
  )
}
