import { Pencil1Icon } from '@radix-ui/react-icons'
import { Grid } from '@radix-ui/themes'
import React, { useContext } from 'react'

import { ProjectsTableContext } from '../projects-table/projects-table-context'

import type { ProjectWithStats } from '@/entities/projects'

import { Button, type MobileAddonBottomProps } from '@/shared'

export const ProjectsMobileAddonBottom = React.memo(
  ({ data }: MobileAddonBottomProps<ProjectWithStats>) => {
    const { handleActionClick, t } = useContext(ProjectsTableContext)

    return (
      <Grid columns={'1fr'} gap={'2'}>
        <Button
          color="neutral"
          variant="outline"
          iconRight={<Pencil1Icon />}
          onClick={() => handleActionClick(data, 'Edit')}
        >
          {t('dashboard.projectsTable.actions.edit')}
        </Button>
      </Grid>
    )
  },
)
