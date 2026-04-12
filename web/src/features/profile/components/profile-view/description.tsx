import { Separator, Flex, Badge } from '@radix-ui/themes'
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
  const { isMobile } = useBreakpoints()

  return (
    <StyledCard gridArea={gridArea} shadow={false}>
      <Flex gap={'4'} direction={'column'}>
        <div>
          <Flex
            justify={{ md: 'between' }}
            direction={{ initial: 'column', md: 'row' }}
            gap={{ initial: '1', md: '0' }}
          >
            <Text size={isMobile ? '5' : '6'} weight={'medium'}>
              Backend Developer
            </Text>

            <Text color={'blue'} $themeVariant={'primary'}>
              <Flex gap={'1'} align={'end'}>
                <Text size={isMobile ? '4' : '8'} weight={'medium'}>
                  35
                </Text>

                <Text size={isMobile ? '2' : undefined}> USDT </Text>
              </Flex>
            </Text>
          </Flex>
        </div>

        <Separator size={'4'} />

        <Text size={isMobile ? '2' : '3'}>
          A highly skilled Backend Developer with expertise in designing,
          developing, and maintaining robust server-side applications.
          Specializing in APIs, databases, and cloud infrastructure, I ensure
          scalable, secure, and high-performance solutions tailored to business
          needs.
        </Text>

        <Separator size={'4'} />

        <div>
          <Text size={isMobile ? '3' : '4'} weight={'medium'}>
            Skills
          </Text>
        </div>

        <Flex gap={'2'} wrap={'wrap'}>
          {skills.map((skill) => (
            <Badge key={skill} color={'gray'} size={isMobile ? '1' : '2'}>
              <Text weight={'medium'} size={'1'}>
                {skill}
              </Text>
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
