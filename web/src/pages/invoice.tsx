import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import styled from 'styled-components'

import { TotalAmount, Worklogs } from '@/features/invoice'
import { IconButton, Text } from '@/features/shared'

export default function InvoicePage() {
  return (
    <FlexWrapper direction={'column'} gap={'20px'}>
      <Flex gap={'2'} direction={'column'}>
        <Flex direction={'column'}>
          <IconWrapper>
            <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
              <ArrowLeftIcon />
            </IconButton>
          </IconWrapper>

          <Text>Project 1</Text>
        </Flex>

        <Text color={'gray'} size={'2'}>
          0:6a5b9c7e2f3d4e5f6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9
        </Text>
      </Flex>

      <TotalAmount />

      <Worklogs />
    </FlexWrapper>
  )
}

const FlexWrapper = styled(Flex)`
  padding: 20px var(--space-3);
`

const IconWrapper = styled.div`
  padding-left: 8px;
`
