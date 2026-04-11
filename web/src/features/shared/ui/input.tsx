import { Grid, type GridProps, type TextProps } from '@radix-ui/themes'
import { TextField, Text } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

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
  textSize?: TextProps['size']
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
  textSize,
  size,
  ...props
}: InputProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const usingGap = label ? (gap ?? (isUpMd ? '24px' : 'var(--space-2)')) : '0'

  return (
    <Grid
      columns={columns ?? { initial: '1', md: `${labelWidth} 1fr` }}
      gap={usingGap}
      rows={rows}
      align={'center'}
      width={'100%'}
    >
      {label && (
        <Text
          as={'label'}
          size={textSize || '2'}
          weight={'medium'}
          htmlFor={id}
        >
          {label}
        </Text>
      )}

      <TextFieldRoot
        id={id}
        size={size ?? (isUpMd ? undefined : '3')}
        {...props}
      >
        {addonLeft && (
          <TextField.Slot side={'left'}>{addonLeft}</TextField.Slot>
        )}

        {addonRight && (
          <TextField.Slot side={'right'}>{addonRight}</TextField.Slot>
        )}
      </TextFieldRoot>
    </Grid>
  )
}

const TextFieldRoot = styled(TextField.Root)`
  /* Находим внутренний input Radix */
  & .rt-TextFieldInput {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  /* Если используешь слоты (addonLeft/Right),
     нужно ограничить ширину контейнера инпута */
  & :where(.rt-TextFieldInput) {
    min-width: 0;
  }
`
