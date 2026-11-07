import type { ComponentProps } from 'react'

import { WorkspacePanel } from '@/shared'

type Props = Omit<ComponentProps<typeof WorkspacePanel>, 'bounded'>

/** Dashboard information panels share the desktop scrolling ceiling. */
export const DashboardWidget = (props: Props) => (
  <WorkspacePanel {...props} bounded />
)
