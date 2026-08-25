import { AxiosError } from 'axios'
import { Cause, Data, Effect, Exit } from 'effect'

/**
 * The generated client returns failures as values (`T | AxiosError`) rather
 * than throwing, so every call site had to remember to test for it. Modelling
 * that as Effect's error channel makes the failure part of the type instead of
 * a convention, and gives one place to add retry or timeout later.
 */
// Data.TaggedError is a class factory, not an error construction - `new` here
// would be a type error, so unicorn/throw-new-error is a false positive.
// eslint-disable-next-line unicorn/throw-new-error
export class ApiError extends Data.TaggedError('ApiError')<{
  readonly cause: unknown
}> {}

/**
 * The generated client's success and failure arms are both intersections, so
 * the failure arm is subtracted by type rather than named directly.
 */
type ApiSuccess<T> = Exclude<T, AxiosError>

/** Lifts a generated-client call into a typed Effect. */
export const fromApi = <T>(
  call: () => Promise<T>,
): Effect.Effect<ApiSuccess<T>, ApiError> =>
  Effect.tryPromise({
    try: call,
    catch: (cause) => new ApiError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result instanceof AxiosError
        ? Effect.fail(new ApiError({ cause: result }))
        : Effect.succeed(result as ApiSuccess<T>),
    ),
  )

/**
 * Boundary back to promise-land, for effector and farfetched handlers.
 *
 * It deliberately does not use Effect.runPromise: that rejects with a
 * FiberFailure wrapper, and both getErrorMessage and farfetched's failure
 * paths test `instanceof AxiosError`. Squashing the cause rethrows the
 * original error, so error handling downstream is unchanged.
 */
export const runApi = async <T>(
  call: () => Promise<T>,
): Promise<ApiSuccess<T>> => {
  const exit = await Effect.runPromiseExit(
    fromApi(call).pipe(Effect.mapError((error) => error.cause)),
  )

  if (Exit.isSuccess(exit)) {
    return exit.value
  }

  throw Cause.squash(exit.cause)
}

/** `runApi` for calls whose body is the only part the caller wants. */
export const runApiData = async <T>(
  call: () => Promise<T>,
): Promise<ApiSuccess<T> extends { data: infer D } ? D : never> => {
  const response = await runApi(call)

  return (response as { data: unknown }).data as never
}
