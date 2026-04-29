import { Cross2Icon } from '@radix-ui/react-icons'
import { Badge, Flex, Grid, Text } from '@radix-ui/themes'
import { useState, type KeyboardEvent, useRef, useEffect } from 'react'
import styled from 'styled-components'

import { useBreakpoint } from '../hooks'

export type TagInputProps = {
  label?: string
  value?: string[]
  onChange?: (value: string[]) => void
  id?: string
  labelWidth?: string
  placeholder?: string
  disabled?: boolean
}

export const TagInput = ({
  label,
  value = [],
  onChange,
  id,
  labelWidth = 'auto',
  placeholder,
  disabled,
}: TagInputProps) => {
  const isDesktop = useBreakpoint('isDesktop')
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange?.([...value, trimmed])
      setInputValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      const nextTags = value.slice(0, -1)
      onChange?.(nextTags)
    }
  }

  const handleContainerClick = () => {
    setFocused(true)
  }

  const handleBlur = () => {
    addTag(inputValue)
    setFocused(false)
  }

  const removeTag = (tagToRemove: string) => {
    const nextTags = value.filter((t) => t !== tagToRemove)
    onChange?.(nextTags)
  }

  const usingGap = label ? (isDesktop ? '24px' : 'var(--space-2)') : '0'

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus()
    }
  }, [focused])

  return (
    <Grid
      columns={{ initial: '1', md: `${labelWidth} 1fr` }}
      gap={usingGap}
      align={'start'}
      width={'100%'}
    >
      {label && (
        <Text
          as={'label'}
          size={'2'}
          weight={'medium'}
          htmlFor={id}
          style={{ marginTop: '8px' }}
        >
          {label}
        </Text>
      )}

      <InputContainer $disabled={disabled} onClick={handleContainerClick}>
        <Flex gap="1" wrap="wrap" align="center" width="100%">
          {value.map((tag) => (
            <Badge key={tag} color="gray" size="2" variant="surface">
              <Flex align="center" gap="1">
                {tag}
                {!disabled && (
                  <RemoveButton
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTag(tag)
                    }}
                  >
                    <Cross2Icon width="12" height="12" />
                  </RemoveButton>
                )}
              </Flex>
            </Badge>
          ))}
          <StyledInput
            ref={inputRef}
            id={id}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </Flex>
      </InputContainer>
    </Grid>
  )
}

const InputContainer = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  padding: var(--space-1) var(--space-1);
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'text')};
  border: 1px solid var(--gray-a7);
  border-radius: var(--radius-2);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:focus-within {
    border-color: var(--blue-8);
    box-shadow: 0 0 0 1px var(--blue-8);
  }

  ${({ $disabled }) =>
    $disabled &&
    `
    opacity: 0.5;
    background-color: var(--gray-a3);
  `}
`

const StyledInput = styled.input`
  flex: 1;
  min-width: 60px;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--font-size-2);
  color: var(--color-text);
  padding: 4px 0;

  &::placeholder {
    color: var(--gray-a10);
  }
`

const RemoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  border-radius: 50%;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }
`
