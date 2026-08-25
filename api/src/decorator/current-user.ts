import { createParamDecorator } from 'routing-controllers'
import { AppContainer } from '@/app/app-container'
import { Authenticator } from '@/service/auth/authenticator'

export function CurrentUser() {
  return createParamDecorator({
    value: (action) => {
      // Deliberately no `action.request.user` short-circuit: nothing in this
      // app populates it, and honouring it would let any middleware (or a
      // body/property-pollution bug) hand back an unverified identity. The
      // token is the only accepted source of identity.
      const authenticator: Authenticator =
        AppContainer.getContainer().get('Authenticator')
      const token = action.request.headers['authorization']

      return authenticator.getUserFromJwtTokenOrThrowException(token)
    },
  })
}
