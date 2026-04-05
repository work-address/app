import { Separator, Flex, Badge } from '@radix-ui/themes'
import styled from 'styled-components'

import { ProfileViewCard } from './styled'

import { Text } from '@/features/shared'

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

export const Description = ({ gridArea }: DescriptionProps) => (
  <StyledCard gridArea={gridArea} shadow={false}>
    <Flex gap={'4'} direction={'column'}>
      <div>
        <Flex justify={'between'}>
          <Text size={'6'} weight={'medium'}>
            Backend Developer
          </Text>

          <Text color={'blue'} themeVariant={'primary'}>
            <Flex gap={'1'} align={'end'}>
              <Text size={'8'}> 35 </Text>
              <Text> USDT </Text>
            </Flex>
          </Text>
        </Flex>
      </div>

      <Separator size={'4'} />

      <Text>
        A highly skilled Backend Developer with expertise in designing,
        developing, and maintaining robust server-side applications.
        Specializing in APIs, databases, and cloud infrastructure, I ensure
        scalable, secure, and high-performance solutions tailored to business
        needs.
      </Text>

      <Separator size={'4'} />

      <div>
        <Text size={'4'} weight={'medium'}>
          Skills
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

const StyledCard = styled(ProfileViewCard)`
  ${(p) => p.theme.breakpoints.down('md')} {
    margin-top: var(--space-3);
  }
`
