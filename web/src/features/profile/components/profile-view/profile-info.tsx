import { Share1Icon, Pencil1Icon, CopyIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { Link } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import { InfoRow } from '../info-row'

import { ProfileViewCard } from './styled'

import { Button, IconButton, routes, Text } from '@/features/shared'

type ProfileInfoProps = {
  gridArea?: string
}

export const ProfileInfo = ({ gridArea }: ProfileInfoProps) => {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex
        gap={'5'}
        direction={'column'}
        justify={'between'}
        style={{ height: '100%' }}
      >
        <Flex justify={'between'} gap={'5'} align={'center'}>
          {isUpMd ? (
            <>
              <Flex direction={'column'} gap={'2'}>
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
            <Flex />
          )}
        </Flex>

        <Flex direction={'column'} gap={'3'}>
          <InfoRow
            icon={<img src={'/img/icons/case.svg'} alt={'Case'} />}
            text={
              <Text>
                <Text color={'gray'}>Works at</Text> Continue
              </Text>
            }
          />
          <InfoRow
            icon={<img src={'/img/icons/linkedin.svg'} alt={'Linkedin'} />}
            text={
              <Text>
                <Text color={'gray'}>linkedin.com/</Text>johndoe
              </Text>
            }
          />
          <InfoRow
            icon={<img src={'/img/icons/facebook.svg'} alt={'Facebook'} />}
            text={
              <Text>
                <Text color={'gray'}>facebook.com/</Text>johndoe
              </Text>
            }
          />
          <InfoRow
            icon={<img src={'/img/icons/telegram.svg'} alt={'Telegram'} />}
            text={
              <Text>
                <Text color={'gray'}>t.me/</Text>johndoe
              </Text>
            }
          />
        </Flex>
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
  padding: 24px 16px;

  ${(p) => p.theme.breakpoints.down('md')} {
    border-top: none;
    padding-top: 0;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
`
