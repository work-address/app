import { Flex } from '@radix-ui/themes'

import type { ReactNode } from 'react'

import { Text } from '@/features/shared'

type InfoRowProps = {
  icon?: ReactNode
  text?: ReactNode
}

export const InfoRow = ({ text, icon }: InfoRowProps) => (
  <Flex gap={'2'} align={'center'}>
    {icon}
    <Text size={'5'}>{text}</Text>
  </Flex>
)
