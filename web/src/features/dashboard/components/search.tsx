import { MagnifyingGlassIcon, Cross1Icon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton, Input, type InputProps } from '@/shared'

type SearchProps = {} & InputProps

export const Search = ({ ...props }: SearchProps) => {
  const [value, setValue] = useState('')
  const { t } = useTranslation()

  return (
    <Input
      {...props}
      placeholder={t('ui.search.placeholderProjects')}
      addonLeft={<MagnifyingGlassIcon width={20} height={20} />}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      addonRight={
        value ? (
          <IconButton
            size={'1'}
            variant={'ghost'}
            onClick={() => setValue('')}
            color={'gray'}
            radius={'full'}
          >
            <Cross1Icon width={15} height={15} />
          </IconButton>
        ) : (
          <Flex width={'15px'} />
        )
      }
    />
  )
}
