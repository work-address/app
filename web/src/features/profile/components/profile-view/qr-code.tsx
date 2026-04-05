import { CopyIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import QrCodeExample from './assets/qr-code-example.png'
import { ProfileViewCard } from './styled'

import { IconButton, Text } from '@/features/shared'
import { Button } from '@/features/shared'

type QrCodeProps = {
  gridArea?: string
  padding?: string
}

export const QrCode = ({ gridArea }: QrCodeProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex
        direction={'column'}
        gap={'3'}
        align={'center'}
        style={{ height: '100%' }}
      >
        {!isUpMd && (
          <>
            <Text size={'7'} weight={'medium'}>
              John Doe
            </Text>

            <Flex gap={'2'} align={'center'}>
              <Text themeVariant={'primary'} size={'3'} weight={'medium'}>
                EQCF9...NDOM
              </Text>

              <IconButton
                variant={'ghost'}
                radius={'medium'}
                themeVariant={'primary'}
                size={'1'}
              >
                <CopyIcon />
              </IconButton>
            </Flex>
          </>
        )}

        <QrCodeImage src={QrCodeExample} alt={'qr-code'} />

        {isUpMd && (
          <Button width={'146px'} themeVariant={'primary'} size={'3'}>
            Share QR-code
          </Button>
        )}
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
  height: 100%;

  ${(p) => p.theme.breakpoints.down('md')} {
    border-bottom: none;
    padding-top: var(--space-3);
    padding-bottom: 0;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  ${(p) => p.theme.breakpoints.up('md')} {
    padding: 33px;
  }
`

const QrCodeImage = styled.img`
  width: 180px;
  height: 180px;
`
