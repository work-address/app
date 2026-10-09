import { Separator, Flex, Badge, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $isAuthenticatedUserProfile,
  $profile,
  $profileLoading,
} from '../../model'

import { ProfileViewCard } from './profile-view-styles'

import { routes } from '@/routes'
import { Button, formatCurrency, Text, useBreakpoint } from '@/shared'

type ProfileViewDescriptionAndSkillsProps = {
  gridArea?: string
}

export const ProfileViewDescriptionAndSkills = ({
  gridArea,
}: ProfileViewDescriptionAndSkillsProps) => {
  const isMobile = useBreakpoint('isMobile')
  const { t } = useTranslation()

  const navigate = useNavigate()

  const { user, profileLoading, isOwn } = useUnit({
    user: $profile,
    profileLoading: $profileLoading,
    isOwn: $isAuthenticatedUserProfile,
  })

  // A rate of zero is an unset rate, not a free service: "$0.00 per hour"
  // on a public profile reads as a broken page.
  const hasRate = Number(user?.rate ?? 0) > 0

  const displayName = user?.name || user?.title
  const jobTitle = user?.title && user.title !== displayName ? user.title : null
  const skills = useMemo(
    () =>
      user?.skills
        ?.split(',')
        .map((skill) => skill.trim())
        .filter(Boolean) ?? [],
    [user?.skills],
  )
  const hasDetails = Boolean(jobTitle || user?.bio) || skills.length > 0

  return (
    <Root $gridArea={gridArea} shadow={false}>
      <Flex gap={'4'} direction={'column'}>
        <div>
          <Flex
            justify={{ md: 'between' }}
            direction={{ initial: 'column', md: 'row' }}
            gap={{ initial: '1', md: '0' }}
          >
            {jobTitle && (
              <Text size={isMobile ? '5' : '6'} weight={'medium'}>
                {jobTitle}
              </Text>
            )}
            {hasRate || profileLoading ? (
              <Text color={'blue'} $themeVariant={'primary'}>
                <Flex gap={'1'} align={'end'}>
                  <Skeleton loading={profileLoading}>
                    <Text size={isMobile ? '4' : '8'} weight={'medium'}>
                      {formatCurrency(user?.rate)}
                    </Text>
                  </Skeleton>
                  <Text size={isMobile ? '2' : '5'}>
                    {t('profile.view.usdtUnit')}
                  </Text>
                </Flex>
              </Text>
            ) : (
              <Text color={'gray'} size={isMobile ? '3' : '4'}>
                {t('profile.view.rateUnset')}
              </Text>
            )}
          </Flex>
        </div>
        {profileLoading ? (
          <>
            <Separator size={'4'} />
            <Skeleton width={'100%'} height={'72px'} loading />
            <Separator size={'4'} />
            <Skeleton width={'120px'} height={'20px'} loading />
            <Skeleton width={'100%'} height={'48px'} loading />
          </>
        ) : (
          <>
            {user?.bio && (
              <>
                <Separator size={'4'} />
                <Text dangerouslySetInnerHTML={{ __html: user.bio }} />
              </>
            )}
            {skills.length > 0 && (
              <>
                <Separator size={'4'} />
                <div>
                  <Text size={isMobile ? '3' : '4'} weight={'medium'}>
                    {t('profile.form.skills')}
                  </Text>
                </div>
                <Flex gap={'2'} wrap={'wrap'} mb={{ initial: '0', md: '2' }}>
                  {skills.map((skill) => (
                    <Badge
                      key={skill}
                      color={'gray'}
                      size={isMobile ? '1' : '2'}
                    >
                      <Text weight={'medium'} size={'1'}>
                        {skill}
                      </Text>
                    </Badge>
                  ))}
                </Flex>
              </>
            )}
            {!hasDetails &&
              (isOwn ? (
                <EmptyOwn>
                  <Text color={'gray'}>
                    {t('profile.view.empty.detailsOwn')}
                  </Text>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        routes.profile.children.edit.build({
                          walletAddress: user?.friendlyWalletAddress ?? '',
                        }),
                      )
                    }
                  >
                    {t('profile.view.empty.addDetails')}
                  </Button>
                </EmptyOwn>
              ) : (
                <Text color={'gray'}>{t('profile.view.empty.details')}</Text>
              ))}
          </>
        )}
      </Flex>
    </Root>
  )
}

const Root = styled(ProfileViewCard)`
  box-shadow: var(--shadow-4);
  ${(p) => p.theme.breakpoints.up('md')} {
    padding: var(--space-5);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--space-5);
  }
`

const EmptyOwn = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
  }
`
