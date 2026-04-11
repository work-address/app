import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { Grid } from '@radix-ui/themes'
import React, { useContext } from 'react'

import { ProjectsTableContext } from './context.ts'

import type { ProjectRow } from './types.ts'

import { Button, type MobileAddonBottomProps } from '@/features/shared'

export const MobileAddonBottom = React.memo(
  ({ data }: MobileAddonBottomProps<ProjectRow>) => {
    const { handleActionClick } = useContext(ProjectsTableContext)

    return (
      <Grid columns={'1fr 1fr'} gap={'2'}>
        <Button
          onClick={() => handleActionClick(data, 'Delete')}
          color={'red'}
          variant={'outline'}
        >
          Delete
          <TrashIcon />
        </Button>

        <Button
          color={'gray'}
          variant={'outline'}
          onClick={() => handleActionClick(data, 'Edit')}
        >
          Edit
          <Pencil1Icon />
        </Button>
      </Grid>
    )
  },
)
