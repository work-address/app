import { Cross2Icon } from '@radix-ui/react-icons'
import {
  Badge,
  Flex,
  Grid,
  Popover,
  ScrollArea,
  Skeleton,
  Text,
  TextField,
} from '@radix-ui/themes'
import {
  useState,
  type KeyboardEvent,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
} from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useBreakpoint } from '../hooks'

import { IconButton } from './button/ui/icon-button'
import { Tooltip } from './tooltip'

import type { InputProps } from './input'

export type TagInputProps = {
  label?: string
  value?: string[]
  onChange?: (value: string[]) => void
  id?: string
  labelWidth?: string
  placeholder?: string
  disabled?: boolean
  showSkeleton?: boolean
  state?: InputProps['state']
  suggestions?: string[]
}

export const TagInput = forwardRef<HTMLInputElement | null, TagInputProps>(
  (
    {
      label,
      value = [],
      onChange,
      id,
      labelWidth = 'auto',
      placeholder,
      disabled,
      showSkeleton = false,
      state,
      suggestions,
    },
    ref,
  ) => {
    const { t } = useTranslation()
    const isDesktop = useBreakpoint('isDesktop')
    const [inputValue, setInputValue] = useState('')
    const innerInputRef = useRef<HTMLInputElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)
    const [focused, setFocused] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const [arrowKeyPressed, setArrowKeyPressed] = useState(false)

    const filteredSuggestions = useMemo(() => {
      if (!suggestions) {
        return []
      }

      const lower = inputValue.toLowerCase()

      return suggestions.filter(
        (s) => s.toLowerCase().includes(lower) && !value.includes(s),
      )
    }, [suggestions, inputValue, value])

    const hasSuggestions = filteredSuggestions.length > 0

    const addTag = useCallback(
      (tag: string) => {
        const trimmed = tag.trim()

        if (trimmed && !value.includes(trimmed)) {
          onChange?.([...value, trimmed])
          setInputValue('')
        }
      },
      [value, onChange],
    )

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (hasSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1))
          setArrowKeyPressed(true)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, -1))
          setArrowKeyPressed(true)
          return
        } else if (e.key === 'Escape') {
          setActiveIndex(-1)
          setInputValue('')
          return
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && activeIndex >= 0) {
          e.preventDefault()
          addTag(filteredSuggestions[activeIndex])
          return
        }
      }

      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        const nextTags = value.slice(0, -1)
        onChange?.(nextTags)
      }
    }

    const handleFocus = () => {
      setFocused(true)
    }

    const handleBlur = () => {
      addTag(inputValue)
      setFocused(false)
      setActiveIndex(-1)
    }

    const removeTag = (tagToRemove: string) => {
      const nextTags = value.filter((t) => t !== tagToRemove)
      onChange?.(nextTags)
    }

    const handleTagClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      e.preventDefault()

      const tag = e.currentTarget.dataset['tag']

      if (tag) {
        removeTag(tag)
      }

      innerInputRef.current?.focus()
    }

    const handleSuggestionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      const tag = e.currentTarget.dataset['tag']

      if (tag) {
        addTag(tag)
      }
    }

    const handleSuggestionOver = (e: React.MouseEvent<HTMLButtonElement>) => {
      const index = Number(e.currentTarget.dataset['activeIndex'])

      if (!isNaN(index)) {
        setActiveIndex(index)
      }
    }

    const handleBadgeMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
    }

    const internalGap = label ? (isDesktop ? '24px' : 'var(--space-2)') : '0'

    const errorProps = useMemo<InputProps | null>(
      () => (state === 'error' ? { color: 'red', variant: 'soft' } : null),
      [state],
    )

    useEffect(() => {
      if (focused) {
        innerInputRef.current?.focus()
      }
    }, [focused])

    useEffect(() => {
      if (arrowKeyPressed) {
        const activeListItem = suggestionsRef?.current?.querySelector(
          `[data-active-index="${activeIndex}"]`,
        )

        activeListItem?.scrollIntoView({
          behavior: 'instant',
          block: 'center',
        })

        setArrowKeyPressed(false)
      }
    }, [activeIndex, arrowKeyPressed])

    useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
      ref,
      () => innerInputRef.current,
      [innerInputRef],
    )

    return (
      <Grid
        columns={{ initial: '1', md: `${labelWidth} 1fr` }}
        gap={internalGap}
        align={'start'}
        width={'100%'}
        ref={suggestionsRef}
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
        <Popover.Root open={hasSuggestions && focused} modal={false}>
          <Popover.Trigger>
            <span style={{ width: '100%' }}>
              <Skeleton loading={showSkeleton}>
                <Field
                  disabled={disabled}
                  onFocus={handleFocus}
                  id={id}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  value={inputValue}
                  placeholder={value.length === 0 ? placeholder : ''}
                  data-grow={focused || value.length === 0 || undefined}
                  ref={innerInputRef}
                  size={isDesktop ? undefined : '3'}
                  {...errorProps}
                >
                  {value.length > 0 && (
                    <>
                      {value.map((tag) => (
                        <Tag
                          key={tag}
                          color="gray"
                          size="2"
                          variant="surface"
                          data-disabled={disabled || undefined}
                        >
                          <Flex align="center" gap="1">
                            {tag}
                            <Flex p="1">
                              <Tooltip
                                content={t('ui.tagInput.remove', { tag })}
                              >
                                <IconButton
                                  size="1"
                                  variant="ghost"
                                  type="button"
                                  radius="full"
                                  data-tag={tag}
                                  aria-label={t('ui.tagInput.remove', { tag })}
                                  onClick={handleTagClick}
                                  onMouseDown={handleBadgeMouseDown}
                                >
                                  <Cross2Icon width="10" height="10" />
                                </IconButton>
                              </Tooltip>
                            </Flex>
                          </Flex>
                        </Tag>
                      ))}
                    </>
                  )}
                </Field>
              </Skeleton>
            </span>
          </Popover.Trigger>
          <Popover.Content
            style={{ padding: 0, width: 'var(--radix-popover-anchor-width)' }}
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            container={document.body}
          >
            <ScrollArea style={{ maxHeight: 220 }}>
              <List ref={suggestionsRef}>
                {filteredSuggestions.map((s, i) => (
                  <Item
                    key={s}
                    type="button"
                    data-active={i === activeIndex || undefined}
                    onMouseDown={handleSuggestionClick}
                    onMouseOver={handleSuggestionOver}
                    data-tag={s}
                    data-active-index={i}
                  >
                    {s}
                  </Item>
                ))}
              </List>
            </ScrollArea>
          </Popover.Content>
        </Popover.Root>
      </Grid>
    )
  },
)

const Field = styled(TextField.Root)`
  min-height: var(--space-7);
  max-height: initial;
  height: initial;
  background-clip: initial;

  flex-wrap: wrap;

  gap: var(--space-1);
  padding: var(--space-1);

  input {
    flex-shrink: 1;
    flex-grow: 0;
    order: 999;
    max-width: 0;
    margin-left: calc(var(--space-1) * -1);
    padding: 2px 0;
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    min-height: var(--space-6);

    input {
      padding: 1px 0;
    }
  }

  &[data-grow] {
    input {
      flex-grow: 1;
      flex-basis: 80px;
      max-width: none;
    }
  }
`

const Tag = styled(Badge)`
  flex-shrink: 1;
  flex-grow: 0;

  &[data-disabled] {
    opacity: 0.5;
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    padding-top: 2px;
    padding-bottom: 2px;
  }
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  padding: var(--space-1) 0;
`

const Item = styled.button`
  all: unset;
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-2);
  cursor: pointer;
  background: transparent;

  &[data-active],
  &:hover {
    background: var(--ds-accent-3);
    color: var(--ds-accent-11);
  }
`
