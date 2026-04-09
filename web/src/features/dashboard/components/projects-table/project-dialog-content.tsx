import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid, Separator } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { ProjectRow } from './types'

import { Text, TextArea, useBreakpoints } from '@/features/shared'

type ProjectRowKeys = (keyof ProjectRow)[]

export const ProjectDialogContent = ({ data }: { data: ProjectRow }) => {
  const { t } = useTranslation()
  const { isMobile, isDesktop } = useBreakpoints()

  const textSize = isMobile ? '2' : '3'

  return (
    <Flex direction={'column'} gap={isDesktop ? '4' : '3'}>
      <Grid columns={{ initial: '125px 1fr' }} gap={isDesktop ? '4' : '3'}>
        {(['startDate', 'publishedIn', 'rate'] satisfies ProjectRowKeys).map(
          (key) => {
            return (
              <>
                <Text color={'gray'} size={textSize}>
                  {t(`dashboard.projectsTable.drawer.meta.${key}`)}
                </Text>

                {key === 'startDate' ? (
                  <Text weight={'medium'} size={textSize}>
                    {data[key] && data[key].toDateString()}
                  </Text>
                ) : (
                  <Text weight={'medium'} size={textSize}>
                    {data[key]}
                  </Text>
                )}
              </>
            )
          },
        )}
      </Grid>

      {isMobile && (
        <>
          <Separator size={'4'} />

          <Grid columns={{ initial: '125px 1fr' }} gap={isDesktop ? '4' : '3'}>
            {(
              [
                'timeTotal',
                'timeActive',
                'keyboard',
                'mouse',
                'mouseDistance',
              ] satisfies ProjectRowKeys
            ).map((key) => {
              return (
                <>
                  <Flex align={'center'} gap={'2'}>
                    <Text color={'gray'} size={textSize}>
                      {t(`dashboard.projectsTable.head.${key}`)}
                    </Text>

                    <QuestionMarkCircledIcon />
                  </Flex>

                  <Text weight={'medium'} size={textSize}>
                    {data[key]}
                  </Text>
                </>
              )
            })}
          </Grid>
        </>
      )}

      <Separator size={'4'} />

      <div>
        <StyledTextArea
          label="Description"
          disabled={true}
          value={data.description}
          rows={10}
        />
      </div>
    </Flex>
  )
}

const StyledTextArea = styled(TextArea)``
