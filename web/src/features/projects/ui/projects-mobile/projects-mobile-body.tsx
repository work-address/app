import { Flex, Grid } from '@radix-ui/themes'
import { memo, useContext } from 'react'

import { ProjectsTableContext } from '../projects-table/projects-table-context'

import type { ProjectWithStats } from '@/entities/projects'
import type { MobileBodyRenderProps } from '@/shared'

import { formatDurationFromMinutes, Hint, Text } from '@/shared'

export const ProjectsMobileBody = memo(
  (props: MobileBodyRenderProps<ProjectWithStats>) => {
    const { t } = useContext(ProjectsTableContext)

    if (props.customKey === 'timeTotal' || props.customKey === 'timeActive') {
      const minutes =
        props.customKey === 'timeTotal'
          ? props.data.minutes
          : props.data.minutesActive

      return (
        <Grid columns={'1fr 1fr'} width={'100%'}>
          <Text color={'gray'} size={'2'} weight={'medium'}>
            <Flex gap={'1'} align={'center'}>
              {props.columnConfig.headerText}
              {props.columnConfig.description && (
                <Hint content={props.columnConfig.description} size={13} />
              )}
            </Flex>
          </Text>
          <Text align={'left'} size={'2'} weight={'medium'}>
            {formatDurationFromMinutes(minutes, t)}
          </Text>
        </Grid>
      )
    }

    return <props.DefaultBodyComponent {...props} />
  },
)
