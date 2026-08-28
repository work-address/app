import { Cause, Effect, Exit } from 'effect'

/**
 * Effect is used at specific boundaries in this api rather than throughout it.
 * The places it earns its keep are the ones where a failure is currently a
 * convention rather than a type: a `catch` that pushes an error into a results
 * array, a `boolean` that hides seven different rejection reasons, three login
 * flows that repeat the same fail-fast pipeline.
 *
 * Everything outside those boundaries keeps throwing. routing-controllers
 * turns a thrown exception into a response via the ErrorHandler middleware,
 * which reads `httpCode` / `violations` off the error to pick a status, so the
 * exception classes in src/exception stay exactly as they are and travel
 * through Effect's error channel as values.
 */

/**
 * Lifts a promise-returning call into an Effect, carrying whatever it rejected
 * with through the error channel unchanged. The identity `catch` is the point:
 * wrapping the cause would hide the `httpCode` that ErrorHandler needs.
 */
export const fromPromise = <A>(
  call: () => Promise<A>,
): Effect.Effect<A, unknown> =>
  Effect.tryPromise({ try: call, catch: (cause) => cause })

/**
 * Boundary back to promise-land, for controllers and any caller that still
 * expects a rejecting promise.
 *
 * It deliberately does not use Effect.runPromise: that rejects with a
 * FiberFailure wrapper, and both ErrorHandler and ErrorFormatter inspect the
 * original exception to choose a status code and shape the body. Squashing the
 * cause rethrows the error the rest of the stack already understands, so
 * converting a method to Effect changes nothing an HTTP client can observe.
 */
export const runPromise = async <A, E>(
  effect: Effect.Effect<A, E>,
): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect)

  if (Exit.isSuccess(exit)) {
    return exit.value
  }

  throw Cause.squash(exit.cause)
}
