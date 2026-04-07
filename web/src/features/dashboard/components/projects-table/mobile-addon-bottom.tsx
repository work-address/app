import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { Grid } from '@radix-ui/themes'
import React from 'react'

import type { ProjectRow } from './types.ts'

import {
  Button,
  type MobileAddonBottomProps,
  showErrorToast,
} from '@/features/shared'

export const MobileAddonBottom = React.memo(
  ({ data }: MobileAddonBottomProps<ProjectRow>) => {
    return (
      <Grid columns={'1fr 1fr'} gap={'2'}>
        <Button
          onClick={() =>
            showErrorToast({
              message: (
                <>
                  API is not connected.
                  <br /> Requested to delete id {data.key}
                </>
              ),
              title: 'Error',
            })
          }
          color={'red'}
          variant={'outline'}
        >
          Delete
          <TrashIcon />
        </Button>

        <Button color={'gray'} variant={'outline'}>
          Edit
          <Pencil1Icon />
        </Button>
      </Grid>
    )
  },
)
