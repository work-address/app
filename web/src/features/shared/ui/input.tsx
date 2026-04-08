import { Grid } from '@radix-ui/themes'
import { TextField, Text } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import type { ReactNode } from 'react'

type InputProps = TextField.RootProps & {
  label?: string
  value?: string
  id?: string
  labelWidth?: string
  addonLeft?: ReactNode
}

export const Input = ({
  label,
  id,
  labelWidth = 'auto',
  addonLeft,
  ...props
}: InputProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return (
    <Grid
      columns={{ initial: '1', md: `${labelWidth} 1fr` }}
      gap={isUpMd ? '24px' : 'var(--space-2)'}
      align={'center'}
    >
      <Text as={'label'} size={'2'} weight={'medium'} htmlFor={id}>
        {label}
      </Text>

      <TextField.Root id={id} {...props}>
        {addonLeft && (
          <TextField.Slot side={'left'}>{addonLeft}</TextField.Slot>
        )}
      </TextField.Root>
    </Grid>
  )
}
