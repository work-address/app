import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import type { ProjectRow } from './types'
import type { MobileBodyRenderProps } from '@/features/shared'

import { formatDurationFromMinutes, Text } from '@/features/shared'

export const MobileBody = (props: MobileBodyRenderProps<ProjectRow>) => {
  const { t } = useTranslation()
  const dataKey = 'dataKey' in props ? props.dataKey : undefined

  if (dataKey === 'timeTotal' || dataKey === 'timeActive') {
    const minutes = props.data[dataKey]

    return (
      <Grid columns={'1fr 1fr'} width={'100%'}>
        <Text color={'gray'} size={'2'} weight={'medium'}>
          <Flex gap={'1'} align={'center'}>
            {props.headerText}
            {props.description && <QuestionMarkCircledIcon />}
          </Flex>
        </Text>

        <Text align={'left'} size={'2'} weight={'medium'}>
          {formatDurationFromMinutes(minutes, t)}
        </Text>
      </Grid>
    )
  }

  return <props.DefaultBodyComponent {...props} />
}
