import { MagnifyingGlassIcon, Cross1Icon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { IconButton } from './button'
import { Input, type InputProps } from './input'
import { Tooltip } from './tooltip'

type SearchProps = {
  value?: string
  onChange?: (
    value: string,
    e?: Parameters<NonNullable<InputProps['onChange']>>[0],
  ) => void
} & Omit<InputProps, 'value' | 'onChange'>

export const SearchInput = ({ ...props }: SearchProps) => {
  const { value, onChange } = props
  const { t } = useTranslation()

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => {
        onChange?.(e.currentTarget.value, e)
      }}
      placeholder={t('ui.search.placeholderProjects')}
      addonLeft={<MagnifyingGlassIcon width={16} height={16} />}
      addonRight={
        value ? (
          <Tooltip content={t('ui.search.clear')}>
            <IconButton
              size={'1'}
              variant={'ghost'}
              onClick={() => onChange?.('')}
              color={'gray'}
              radius={'full'}
              aria-label={t('ui.search.clear')}
            >
              <Cross1Icon width={12} height={12} />
            </IconButton>
          </Tooltip>
        ) : (
          <Flex width={'15px'} />
        )
      }
    />
  )
}
