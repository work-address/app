import { useUnit } from 'effector-react'
import { Navigate } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { routes } from '@/routes'
import { RouteSkeleton } from '@/shared'

export default function OwnProfilePage() {
  const { user } = useUnit({
    user: $user,
  })

  // The signed-in user is still loading; a blank sheet would read as broken.
  if (!user) {
    return <RouteSkeleton variant="document" />
  }

  return (
    <Navigate
      to={routes.profile.build({
        id: user.id ?? '',
      })}
      replace
    />
  )
}
