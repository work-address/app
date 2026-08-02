import { Pencil1Icon } from '@radix-ui/react-icons'
import { Grid } from '@radix-ui/themes'
import React, { useContext } from 'react'

import { ProjectsTableContext } from './context.ts'

import type { ProjectWithStats } from '@/entities/projects'

import { Button, type MobileAddonBottomProps } from '@/shared'

export const MobileAddonBottom = React.memo(
  ({ data }: MobileAddonBottomProps<ProjectWithStats>) => {
    const { handleActionClick, t } = useContext(ProjectsTableContext)

    return (
      <Grid columns={'1fr'} gap={'2'}>
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
