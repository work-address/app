import { Action } from 'routing-controllers'

import { Authenticator } from '@/service/auth/authenticator'
import { EUserRole } from '@/model/user'
import { AppContainer } from '@/app/app-container'
import { runPromise } from '@/service/effect-bridge'

export const ValidateRoles = async (action: Action, roles: string[] = []) => {
  const authenticator: Authenticator =
    AppContainer.getContainer().get('Authenticator')
  const token = action.request.headers.authorization as string
  const user = await runPromise(
    authenticator.getUserFromJwtTokenOrThrowException(token),
  )

  let isValid = false

  if (roles.length === 0) {
    isValid = true
  }

  roles.forEach((r: string) => {
    if (user.roles.includes(r as EUserRole)) {
      isValid = true
    }
  })

  return isValid
}
