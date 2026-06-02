import { Separator, Flex, Badge, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $profile } from '../../model'

import { ProfileViewCard } from './styled'

import { $pending } from '@/entities/profile'
import { Text, useBreakpoint } from '@/shared'

type DescriptionProps = {
  gridArea?: string
}

const mockData = [
  'Python',
  'JavaScript',
  'Java',
  'Express.js',
  'MySQL',
  'GraphQL',
  'Google Cloud',
  'Authentication',
  'GitHub',
  'Unit testing',
  '+12',
]

export const DescriptionAndSkills = ({ gridArea }: DescriptionProps) => {
  const isMobile = useBreakpoint('isMobile')
  const { t } = useTranslation()

  const { user, profileLoading } = useUnit({
    user: $profile,
    profileLoading: $pending,
  })

  const skills = useMemo(
    () =>
      user?.skills
        ? user?.skills?.split(',').filter((s) => Boolean(s.trim()))
        : mockData,
    [user?.skills],
  )

  return (
    <StyledCard $gridArea={gridArea} shadow={false}>
      <Flex gap={'4'} direction={'column'}>
        <div>
          <Flex justify={'between'}>
            <Text size={'6'} weight={'medium'}>
              {t('profile.view.jobTitle')}
            </Text>

            <Text color={'blue'} $themeVariant={'primary'}>
              <Flex gap={'1'} align={'end'}>
                <Skeleton loading={profileLoading}>
                  <Text size={isMobile ? '4' : '8'} weight={'medium'}>
                    {user?.rate || 0}
                  </Text>
                </Skeleton>

                <Text size={isMobile ? '2' : undefined}>
                  {t('profile.view.usdtUnit')}
                </Text>
              </Flex>
            </Text>
          </Flex>
        </div>

        <Separator size={'4'} />

        <Skeleton loading={profileLoading}>
          <Text
            dangerouslySetInnerHTML={{
              __html: user?.bio || t('profile.view.bio'),
            }}
          />
        </Skeleton>

        <Separator size={'4'} />

        <div>
          <Text size={'4'} weight={'medium'}>
            {t('profile.form.skills')}
          </Text>
        </div>

        <Skeleton loading={profileLoading}>
          <Flex gap={'2'} wrap={'wrap'} mb={{ initial: '0', md: '2' }}>
            {skills.map((skill) => (
              <Badge key={skill} color={'gray'} size={isMobile ? '1' : '2'}>
                <Text weight={'medium'} size={'1'}>
                  {skill}
                </Text>
              </Badge>
            ))}
          </Flex>
        </Skeleton>
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
  ${(p) => p.theme.breakpoints.up('md')} {
    padding-top: 26px;
    padding-bottom: 24px;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    margin-top: var(--space-3);
    padding: var(--space-5);
  }
`
