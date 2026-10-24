import { Grid } from '@radix-ui/themes'
import { TextArea as RadixTextArea, Text } from '@radix-ui/themes'
import { useId } from 'react'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import { Hint } from './hint'

import type { TextAreaProps as RadixTextAreaProps } from '@radix-ui/themes'

type TextAreaProps = RadixTextAreaProps & {
  label?: string
  /** Explains the label in a question-mark tooltip beside it. */
  hint?: string
  value?: string
  id?: string
  state?: 'error' | 'valid'
  /** Said under the field while `state` is `error`, as Input does. */
  errorMessage?: string
  /** Fill the height its parent gives it, beyond `rows`. */
  grow?: boolean
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
  errorMessage,
  grow,
  size,
  ...props
}: TextAreaProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))
  const generatedId = useId()
  const errorId = `${id ?? generatedId}-error`
  const showError = state === 'error' && Boolean(errorMessage)

  const errorProps: TextAreaProps | null =
    state === 'error' ? { color: 'red', variant: 'soft' } : null

  return (
    // The label sits as close to its box as an Input's stacked label does.
    <Root
      columns={{ initial: '1' }}
      gap={'var(--space-2)'}
      align={'center'}
      data-grow={grow || undefined}
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
      <Field
        id={id}
        size={size ?? (isUpMd ? undefined : '3')}
        {...props}
        aria-invalid={state === 'error' || props['aria-invalid'] || undefined}
        aria-describedby={
          [props['aria-describedby'], showError ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        {...errorProps}
      />
      {showError ? (
        <Error id={errorId} role="alert">
          {errorMessage}
        </Error>
      ) : null}
    </Root>
  )
}

const Root = styled(Grid)`
  &[data-grow] {
    height: 100%;
    grid-template-rows: auto minmax(0, 1fr);
    align-items: stretch;
  }
`

const Field = styled(RadixTextArea)`
  [data-grow] > & {
    height: 100%;
  }
`

const Error = styled.p`
  color: var(--red-11);
  font-size: var(--font-size-2);
  line-height: var(--line-height-2);
`
