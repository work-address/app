import { Grid, type GridProps, type TextProps } from '@radix-ui/themes'
import { TextField, Text } from '@radix-ui/themes'
import { forwardRef, type ReactNode } from 'react'
import styled from 'styled-components'
import { match, P } from 'ts-pattern'

import { useBreakpoint } from '../hooks'

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
  textWeight?: TextProps['weight']
  state?: 'error' | 'valid'
}

export const Input = forwardRef(
  (
    {
      label,
      id,
      labelWidth = 'auto',
      addonLeft,
      addonRight,
      columns,
      gap,
      rows,
      textSize,
      textWeight,
      state,
      size,
      onChange,
      ...props
    }: InputProps,
    ref: React.Ref<HTMLInputElement>,
  ) => {
    const isDesktop = useBreakpoint('isDesktop')

    const usingGap = label
      ? (gap ?? (isDesktop ? '24px' : 'var(--space-2)'))
      : '0'

    const errorProps: InputProps | null =
      state === 'error' ? { color: 'red', variant: 'soft' } : null

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = match(props.inputMode)
        .with('decimal', () =>
          e.target.value
            .replace(',', '.')
            .replaceAll(/[^\d.]/g, '')
            .replace(/^(\d*\.?\d*).*$/, '$1'),
        )
        .with('numeric', () => e.target.value.replaceAll(/\D/g, ''))
        .with(P.any, () => e.target.value)
        .exhaustive()

      onChange?.(e)
    }

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
            weight={textWeight || 'medium'}
            htmlFor={id}
          >
            {label}
          </Text>
        )}

        <TextFieldRoot
          id={id}
          size={size ?? (isDesktop ? undefined : '3')}
          ref={ref}
          {...props}
          {...errorProps}
          onChange={handleChange}
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
  },
)

const TextFieldRoot = styled(TextField.Root)`
  & .rt-TextFieldInput {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  & :where(.rt-TextFieldInput) {
    min-width: 0;
  }
`
