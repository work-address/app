import { CopyIcon, Pencil1Icon, Share1Icon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { ProfileViewCard } from './styled'

import { IconButton, routes, Text, useBreakpoints } from '@/features/shared'
import { Button } from '@/features/shared'

type QrCodeProps = {
  gridArea?: string
  padding?: string
}

export const QrCode = ({ gridArea }: QrCodeProps) => {
  const { isMobile } = useBreakpoints()

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex
        direction={'column'}
        gap={{ initial: '4' }}
        align={'center'}
        style={{ height: '100%' }}
      >
        {isMobile && (
          <Flex direction={'column'} align={'center'} gap={{ initial: '2' }}>
            <Text size={'6'} weight={'medium'}>
              John Doe
            </Text>

            <Flex gap={'2'} align={'center'}>
              <Text $themeVariant={'primary'} size={'2'} weight={'medium'}>
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
          </Flex>
        )}

        <QrCodeImage src={'/img/photo/qr-code-example.svg'} alt={'qr-code'} />

        {isMobile ? (
          <Flex gap={'2'} direction={'column'} width={'100%'}>
            <Link to={routes.profile.children.edit.schema}>
              <Button stretch themeVariant={'primary'}>
                Edit <Pencil1Icon />
              </Button>
            </Link>

            <Button stretch variant={'outline'} color={'gray'}>
              Share <Share1Icon />
            </Button>
          </Flex>
        ) : (
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
  width: 140px;
  height: 140px;

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 180px;
    height: 180px;
  }
`
