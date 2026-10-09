import { Grid, type GridProps, type TextProps } from '@radix-ui/themes'
import { TextField, Text } from '@radix-ui/themes'
import { forwardRef, useId, type ReactNode } from 'react'
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
  errorMessage?: string
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
      errorMessage,
      size,
      onChange,
      ...props
    }: InputProps,
    ref: React.Ref<HTMLInputElement>,
  ) => {
    const isDesktop = useBreakpoint('isDesktop')
    const generatedId = useId()
    const resolvedId = id ?? generatedId
    const errorId = `${resolvedId}-error`

    // A label above its field sits close to it; a label beside it (the
    // two-column profile form) needs a gutter. Stacked is the norm, so the
    // wide gap only applies to the explicit side-by-side layout on a desktop.
    const isStacked = columns === '1' || columns === '1fr' || Boolean(rows)
    const usingGap = label
      ? (gap ?? (isDesktop && !isStacked ? 'var(--space-5)' : 'var(--space-2)'))
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
      <Root
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
            htmlFor={resolvedId}
          >
            {label}
          </Text>
        )}
        <Field
          id={resolvedId}
          size={size ?? (isDesktop ? undefined : '3')}
          ref={ref}
          {...props}
          aria-invalid={state === 'error' || props['aria-invalid'] || undefined}
          aria-describedby={
            [
              props['aria-describedby'],
              state === 'error' && errorMessage ? errorId : undefined,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          {...errorProps}
          onChange={handleChange}
        >
          {addonLeft && (
            <TextField.Slot side={'left'}>{addonLeft}</TextField.Slot>
          )}
          {addonRight && (
            <TextField.Slot side={'right'}>{addonRight}</TextField.Slot>
          )}
        </Field>
        {state === 'error' && errorMessage ? (
          <Error id={errorId} role="alert">
            {errorMessage}
          </Error>
        ) : null}
      </Root>
    )
  },
)

const Root = styled(Grid)``

const Field = styled(TextField.Root)`
  & .rt-TextFieldInput {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  & :where(.rt-TextFieldInput) {
    min-width: 0;
  }
`

const Error = styled.p`
  grid-column: 1 / -1;
  color: var(--red-11);
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
`
