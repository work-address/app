import { MagnifyingGlassIcon, Cross1Icon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { IconButton, Input, type InputProps } from '@/shared'

type SearchProps = {
  value?: string
  onChange?: (
    value: string,
    e?: Parameters<NonNullable<InputProps['onChange']>>[0],
  ) => void
} & Omit<InputProps, 'value' | 'onChange'>

export const Search = ({ ...props }: SearchProps) => {
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
      addonLeft={<MagnifyingGlassIcon width={20} height={20} />}
      addonRight={
        value ? (
          <IconButton
            size={'1'}
            variant={'ghost'}
            onClick={() => onChange?.('')}
            color={'gray'}
            radius={'full'}
          >
            <Cross1Icon width={12} height={12} />
          </IconButton>
        ) : (
          <Flex width={'15px'} />
        )
      }
    />
  )
}
