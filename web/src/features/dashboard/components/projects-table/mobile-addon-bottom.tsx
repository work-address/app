import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { Grid } from '@radix-ui/themes'
import React, { useContext } from 'react'

import { ProjectsTableContext } from './context.ts'

import type { ProjectWithStats } from '@/entities/activities'

import { Button, type MobileAddonBottomProps } from '@/shared'

export const MobileAddonBottom = React.memo(
  ({ data }: MobileAddonBottomProps<ProjectWithStats>) => {
    const { handleActionClick, t } = useContext(ProjectsTableContext)

    return (
      <Grid columns={'1fr 1fr'} gap={'2'}>
        <Button
          onClick={() => handleActionClick(data, 'Delete')}
          color={'red'}
          variant={'outline'}
        >
          {t('dashboard.projectsTable.actions.delete')}
          <TrashIcon />
        </Button>
        <Button
          color={'gray'}
          variant={'outline'}
          onClick={() => handleActionClick(data, 'Edit')}
        >
          {t('dashboard.projectsTable.actions.edit')}
          <Pencil1Icon />
        </Button>
      </Grid>
    )
  },
)
