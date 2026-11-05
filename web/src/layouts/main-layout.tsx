import { useUnit } from 'effector-react'
import { Navigate, useLocation } from 'react-router-dom'

import { PublicLayout } from './public-layout'

import { $authenticated, $signedOutOnPurpose } from '@/entities/profile'
import { returnState, routes } from '@/routes'

export { PublicLayout } from './public-layout'

export const MainLayout = () => {
  const location = useLocation()
  const { authenticated, signedOutOnPurpose } = useUnit({
    authenticated: $authenticated,
    signedOutOnPurpose: $signedOutOnPurpose,
  })

  if (!authenticated) {
    return (
      <Navigate
        to={routes.signIn.build()}
        state={signedOutOnPurpose ? undefined : returnState(location)}
        replace
      />
    )
  }

  return <PublicLayout />
}
