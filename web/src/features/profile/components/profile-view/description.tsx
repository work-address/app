import { Separator, Flex, Badge } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProfileViewCard } from './styled'

import { Text, useBreakpoints } from '@/features/shared'

type DescriptionProps = {
  gridArea?: string
}

const skills = [
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

export const Description = ({ gridArea }: DescriptionProps) => {
  const { t } = useTranslation()

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex gap={'4'} direction={'column'}>
        <div>
          <Flex justify={'between'}>
            <Text size={'6'} weight={'medium'}>
              {t('profile.view.jobTitle')}
            </Text>

            <Text color={'blue'} $themeVariant={'primary'}>
              <Flex gap={'1'} align={'end'}>
                <Text size={isMobile ? '4' : '8'} weight={'medium'}>
                  35
                </Text>

                <Text size={isMobile ? '2' : undefined}>
                  {' '}
                  {t('profile.view.usdtUnit')}{' '}
                </Text>
              </Flex>
            </Text>
          </Flex>
        </div>

        <Separator size={'4'} />

        <Text>{t('profile.view.bio')}</Text>

        <Separator size={'4'} />

        <div>
          <Text size={'4'} weight={'medium'}>
            {t('profile.form.skills')}
          </Text>
        </div>

        <Flex gap={'2'} wrap={'wrap'}>
          {skills.map((skill) => (
            <Badge key={skill} color={'gray'} size={'2'}>
              {skill}
            </Badge>
          ))}
        </Flex>
      </Flex>
    </StyledCard>
  )
}

const StyledCard = styled(ProfileViewCard)`
  ${(p) => p.theme.breakpoints.down('md')} {
    margin-top: var(--space-3);
    padding: var(--space-5);
  }
`
