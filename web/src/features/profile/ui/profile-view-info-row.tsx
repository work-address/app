import { Flex } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ReactNode } from 'react'

import { Text } from '@/shared'

type ProfileViewInfoRowProps = {
  icon?: ReactNode
  text?: ReactNode
  hoverEffects?: boolean
}

export const ProfileViewInfoRow = ({
  text,
  icon,
  hoverEffects = true,
}: ProfileViewInfoRowProps) => {
  return (
    <Flex gap={'2'} align={'center'}>
      {icon}
      <StyledText size={{ initial: '2', md: '4' }} $hoverEffects={hoverEffects}>
        {text}
      </StyledText>
    </Flex>
  )
}

const StyledText = styled(Text)<{ $hoverEffects?: boolean }>`
  ${(p) =>
    p.$hoverEffects &&
    `
    border-bottom: 1px solid transparent;
    transition: border-bottom 0.2s ease-in-out;

    &:hover {
      border-bottom: 1px solid var(--gray-6);
    }
  `}
`
