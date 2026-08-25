import { createEffect } from 'effector'

export type NavigateRequest = {
  to: string
  options?: { replace?: boolean; viewTransition?: boolean }
}

type NavigateHandler = (request: NavigateRequest) => void | Promise<void>

const unbound: NavigateHandler = () => {
  throw new Error(
    'navigateFx was called before bindNavigate() ran - bind the router first',
  )
}

/**
 * Navigation as an effect, so a model can route as the target of a sample
 * instead of a component mirroring store state into useNavigate. The handler
 * is injected once at app start (bindNavigate) and can be swapped in tests.
 */
export const navigateFx = createEffect<NavigateRequest, void>(unbound)

export const bindNavigate = (handler: NavigateHandler): void => {
  navigateFx.use(handler)
}
