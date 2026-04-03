import { Grid } from '@radix-ui/themes'
import { TextField, Text } from '@radix-ui/themes'

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
  return (
    <Grid
      columns={{ initial: '1', sm: `${labelWidth} 1fr` }}
      gap={'24px'}
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
