import { Share1Icon, Pencil1Icon, CopyIcon } from '@radix-ui/react-icons'
import { Flex, type FlexProps } from '@radix-ui/themes'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { InfoRow } from '../info-row'

import { ProfileViewCard } from './styled'

import {
  Button,
  routes,
  showInfoToast,
  Text,
  useBreakpoints,
} from '@/features/shared'

type ProfileInfoProps = {
  gridArea?: string
}

export const ProfileInfo = ({ gridArea }: ProfileInfoProps) => {
  const { isDesktop } = useBreakpoints()
  const walletAddress = 'EQCF9...NDOM'

  const infoRowGap: FlexProps['gap'] = {
    initial: '2px',
    md: '1',
  }

  const handleCopyWalletAddress = async () => {
    await navigator.clipboard.writeText(walletAddress)

    showInfoToast({
      message: 'Address copied to clipboard',
      position: 'top-center',
    })
  }

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex
        gap={{ initial: '4', md: '5' }}
        direction={'column'}
        justify={'between'}
        style={{ height: '100%' }}
      >
        <Flex justify={'between'} gap={'5'} align={'center'}>
          {isDesktop ? (
            <>
              <Flex direction={'column'} gap={'2'}>
                <Text size={'7'} weight={'medium'}>
                  John Doe
                </Text>

                <Flex gap={'2'} align={'center'}>
                  <Button variant={'ghost'} onClick={handleCopyWalletAddress}>
                    <Text
                      $themeVariant={'primary'}
                      size={'3'}
                      weight={'medium'}
                    >
                      {walletAddress}
                    </Text>

                    <CopyIcon />
                  </Button>
                </Flex>
              </Flex>

              <Flex gap={'2'}>
                <Button variant={'outline'} color={'gray'} size={'3'}>
                  Share
                  <Share1Icon />
                </Button>

                <Link to={routes.profile.children.edit.schema}>
                  <Button themeVariant={'primary'} size={'3'}>
                    Edit
                    <Pencil1Icon />
                  </Button>
                </Link>
              </Flex>
            </>
          ) : (
            <div />
          )}
        </Flex>

        <Flex direction={'column'} gap={{ initial: '3', md: '4' }}>
          <InfoRow
            icon={<img src={'/img/icons/case.svg'} alt={'Case'} />}
            text={
              <Flex gap={infoRowGap}>
                <Text color={'gray'}>Works at</Text>
                <Text weight={'medium'}>Continue</Text>
              </Flex>
            }
          />
          <InfoRow
            icon={<img src={'/img/icons/linkedin.svg'} alt={'Linkedin'} />}
            text={
              <Flex gap={infoRowGap}>
                <Text color={'gray'}>linkedin.com/</Text>
                <Text weight={'medium'}>johndoe</Text>
              </Flex>
            }
          />
          <InfoRow
            icon={<img src={'/img/icons/facebook.svg'} alt={'Facebook'} />}
            text={
              <Flex gap={infoRowGap}>
                <Text color={'gray'}>facebook.com/</Text>
                <Text weight={'medium'}>johndoe</Text>
              </Flex>
            }
          />
          <InfoRow
            icon={<img src={'/img/icons/telegram.svg'} alt={'Telegram'} />}
            text={
              <Flex gap={infoRowGap}>
                <Text color={'gray'}>t.me/</Text>
                <Text weight={'medium'}>johndoe</Text>
              </Flex>
            }
          />
        </Flex>
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
  ${(p) => p.theme.breakpoints.up('md')} {
    padding-bottom: var(--space-6);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    border-top: none;
    padding-top: 0;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
`
