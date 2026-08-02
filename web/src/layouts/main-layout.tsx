import { useUnit } from 'effector-react'
import { Navigate } from 'react-router-dom'

import { PublicLayout } from './public-layout.tsx'

import { $authenticated } from '@/entities/profile'
import { routes } from '@/routes'

export { PublicLayout } from './public-layout.tsx'

export const MainLayout = () => {
  const { authenticated } = useUnit({
    authenticated: $authenticated,
  })

  if (!authenticated) {
    return <Navigate to={routes.signIn.build()} />
  }

  return <PublicLayout />
}
