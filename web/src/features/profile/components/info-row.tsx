import { Flex } from '@radix-ui/themes'

import type { ReactNode } from 'react'

import { Text } from '@/features/shared'

type InfoRowProps = {
  icon?: ReactNode
  text?: ReactNode
}

export const InfoRow = ({ text, icon }: InfoRowProps) => {
  return (
    <Flex gap={'2'} align={'center'}>
      {icon}
      <Text size={{ initial: '2', md: '4' }}>{text}</Text>
    </Flex>
  )
}
