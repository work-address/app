import { useUnit } from 'effector-react'
import { Navigate } from 'react-router-dom'

import { $user } from '@/entities/profile'
import { routes } from '@/routes'

export default function OwnProfilePage() {
  const { user } = useUnit({
    user: $user,
  })

  if (!user) {
    return null
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
