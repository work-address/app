import { MemoryRouter } from 'react-router-dom'

import { Sidebar as AppSidebar } from '@/widgets'
import '@/shared/i18n/i18n'
import '@/app/app.css'

// The sidebar marks the current page, so it needs a router to read it from.
export const Sidebar = () => (
  <MemoryRouter>
    <AppSidebar />
  </MemoryRouter>
)
