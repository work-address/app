import { Cross2Icon } from '@radix-ui/react-icons'
import { Badge, Flex, Grid, IconButton, Skeleton, Text } from '@radix-ui/themes'
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
  showSkeleton?: boolean
}

export const TagInput = ({
  label,
  value = [],
  onChange,
  id,
  labelWidth = 'auto',
  placeholder,
  disabled,
  showSkeleton = false,
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

      <Skeleton loading={showSkeleton}>
        <InputContainer $disabled={disabled} onClick={handleContainerClick}>
          <Flex gap="1" wrap="wrap" align="center" width="100%">
            {value.map((tag) => (
              <StyledBadge key={tag} color="gray" size="2" variant="surface">
                <Flex align="center" gap="1">
                  {tag}

                  {!disabled && (
                    <Flex p="1">
                      <IconButton
                        size="1"
                        variant="ghost"
                        type="button"
                        radius="full"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTag(tag)
                        }}
                      >
                        <Cross2Icon width="10" height="10" />
                      </IconButton>
                    </Flex>
                  )}
                </Flex>
              </StyledBadge>
            ))}

            {value.length === 0 && !focused && (
              <StyledPlaceholder>{placeholder}</StyledPlaceholder>
            )}

            {focused && (
              <StyledTagInput
                ref={inputRef}
                id={id}
                disabled={disabled}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
              />
            )}
          </Flex>
        </InputContainer>
      </Skeleton>
    </Grid>
  )
}

const InputContainer = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  padding: var(--space-1);
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'text')};
  border: 1px solid var(--gray-a7);
  border-radius: var(--radius-2);
  min-height: var(--space-7);

  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:focus-within {
    border-color: var(--focus-8);
    box-shadow: 0 0 0 1px var(--focus-8);
  }

  ${({ $disabled }) =>
    $disabled &&
    `
    opacity: 0.5;
    background-color: var(--gray-a3);
  `}

  ${(p) => p.theme.breakpoints.up('md')} {
    min-height: var(--space-6);
  }
`

const StyledBadge = styled(Badge)`
  ${(p) => p.theme.breakpoints.up('md')} {
    padding-top: 1px;
    padding-bottom: 1px;
  }
`

const StyledTagInput = styled.input`
  flex: 1;
  min-width: 60px;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  color: var(--color-text);
  padding: 4px 4px;
  font-size: var(--font-size-3);

  &::placeholder {
    color: var(--gray-a10);
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    font-size: var(--font-size-2);
    padding: 1px 4px;
  }
`

const StyledPlaceholder = styled.span`
  color: var(--gray-a10);
  font-family: inherit;
  font-size: var(--font-size-2);
  padding: 0 var(--space-1);
`
