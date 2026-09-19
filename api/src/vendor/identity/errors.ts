export type ProfileErrorCode =
  | 'InvalidField'
  | 'UnknownField'
  | 'NotDisclosable'
  | 'InvalidSubject'
  | 'UnsupportedSubjectScheme'
  | 'InvalidRandomness'
  | 'InvalidDocument'
  | 'RootMismatch'
  | 'SignatureInvalid'

/** Thrown while building or restoring; checking a presentation returns a result instead. */
export class ProfileError extends Error {
  readonly code: ProfileErrorCode

  constructor(code: ProfileErrorCode, message: string) {
    super(message)
    this.name = 'ProfileError'
    this.code = code
  }
}
