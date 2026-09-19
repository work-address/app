import { createParamDecorator } from 'routing-controllers'
import { AppContainer } from '@/app/app-container'
import { Authenticator } from '@/service/auth/authenticator'
import { runPromise } from '@/service/effect-bridge'

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

      // routing-controllers awaits a promise here, not an Effect, so this is
      // one of the boundaries where the effect has to be run.
      return runPromise(
        authenticator.getUserFromJwtTokenOrThrowException(token),
      )
    },
  })
}

/**
 * The caller when a valid token names one, and null otherwise - for an
 * anonymous route whose answer also depends on whether the caller is the
 * account being read. A missing, malformed or expired token is not an error
 * here: it simply identifies nobody, exactly as no token does.
 */
export function OptionalCurrentUser() {
  return createParamDecorator({
    value: (action) => {
      const authenticator: Authenticator =
        AppContainer.getContainer().get('Authenticator')
      const token = action.request.headers['authorization']

      return runPromise(authenticator.getUserFromJwtToken(token))
    },
  })
}
