import { Grid, type GridProps } from '@radix-ui/themes'
import { TextField, Text } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import type { ReactNode } from 'react'

export type InputProps = TextField.RootProps & {
  label?: string
  value?: string
  id?: string
  labelWidth?: string
  addonLeft?: ReactNode
  addonRight?: ReactNode
  columns?: GridProps['columns']
  gap?: GridProps['gap']
  rows?: GridProps['rows']
}

export const Input = ({
  label,
  id,
  labelWidth = 'auto',
  addonLeft,
  addonRight,
  columns,
  gap,
  rows,
  ...props
}: InputProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return (
    <Grid
      columns={columns ?? { initial: '1', md: `${labelWidth} 1fr` }}
      gap={gap ?? (isUpMd ? '24px' : 'var(--space-2)')}
      rows={rows}
      align={'center'}
    >
      <Text as={'label'} size={'2'} weight={'medium'} htmlFor={id}>
        {label}
      </Text>

      <TextField.Root id={id} size={isUpMd ? undefined : '3'} {...props}>
        {addonLeft && (
          <TextField.Slot side={'left'}>{addonLeft}</TextField.Slot>
        )}

        {addonRight && (
          <TextField.Slot side={'right'}>{addonRight}</TextField.Slot>
        )}
      </TextField.Root>
    </Grid>
  )
}
