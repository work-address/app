import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid, Separator } from '@radix-ui/themes'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { ProjectRow } from './types'

import { type InputProps } from '@/features/shared'
import { Input, Text, TextArea, useBreakpoints } from '@/features/shared'

type ProjectRowKeys = (keyof ProjectRow)[]

type ProjectDialogContentProps = {
  data: ProjectRow
  mode: 'view' | 'edit'
}

export const ProjectDialogContent = ({
  data,
  mode,
}: ProjectDialogContentProps) => {
  const { t } = useTranslation()
  const { isMobile, isDesktop } = useBreakpoints()

  const { register } = useForm({
    values: data,
  })

  const textSize = isMobile ? '2' : '3'

  if (mode === 'edit') {
    const inputProps: InputProps = {
      rows: 'auto auto',
      columns: '1fr',
      gap: '2',
      size: '3',
    }

    return (
      <Flex direction={'column'} gap={'4'}>
        <Input
          label={'Project name'}
          id={'projectName'}
          {...inputProps}
          {...register('name')}
        />

        <Input
          label={'Published in'}
          id={'publishedIn'}
          {...inputProps}
          {...register('publishedIn')}
        />

        <Input
          label={'Rate'}
          addonRight={'$'}
          id={'rate'}
          {...inputProps}
          {...register('rate')}
        />

        <Separator size={'4'} />

        <TextArea
          label={'Description'}
          placeholder={'Enter a brief description of your project'}
          rows={7}
          id={'description'}
          size={'3'}
          {...register('description')}
        />
      </Flex>
    )
  }

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
        <TextArea
          label="Description"
          disabled={true}
          value={data.description}
          rows={12}
          size={'3'}
        />
      </div>
    </Flex>
  )
}
