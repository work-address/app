import { Flex, Grid, Separator } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import type { ProjectRow } from './types'

import { useBreakpoints, Text, TextArea } from '@/features/shared'

type ProjectRowKeys = (keyof ProjectRow)[]

export const ProjectDialogContent = ({ data }: { data: ProjectRow }) => {
  const { isDesktop } = useBreakpoints()
  const { t } = useTranslation()

  return (
    <Flex direction={'column'} gap={'3'}>
      {isDesktop && (
        <>
          <Text size={'4'} weight={'medium'}>
            {data.name}
          </Text>
          <Separator size={'4'} />
        </>
      )}

      <Grid columns={{ initial: '125px 1fr' }} gap={'3'}>
        {(['startDate', 'publishedIn', 'rate'] satisfies ProjectRowKeys).map(
          (key) => {
            return (
              <>
                <Text color={'gray'}>
                  {t(`dashboard.projectsTable.drawer.meta.${key}`)}
                </Text>

                {key === 'startDate' ? (
                  <Text weight={'regular'}>
                    {data[key] && data[key].toDateString()}
                  </Text>
                ) : (
                  <Text weight={'medium'}>{data[key]}</Text>
                )}
              </>
            )
          },
        )}
      </Grid>

      <Separator size={'4'} />

      <Grid columns={{ initial: '125px 1fr' }} gap={'3'}>
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
              <Text color={'gray'}>
                {t(`dashboard.projectsTable.head.${key}`)}
              </Text>

              <Text weight={'medium'}>{data[key]}</Text>
            </>
          )
        })}
      </Grid>

      <Separator size={'4'} />

      <div>
        <TextArea
          label="Description"
          disabled={true}
          value={data.description}
          rows={10}
        />
      </div>
    </Flex>
  )
}
