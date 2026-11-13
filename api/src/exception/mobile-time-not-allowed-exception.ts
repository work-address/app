/**
 * Raised, per entry, when the phone app uploads time for a project whose owner
 * has not allowed tracking from a phone, and the entry did not start while it
 * was allowed. A name of its own, so the phone can tell the worker why, and so
 * the time is never stored as desktop time instead.
 */
class MobileTimeNotAllowedException extends Error {
  public static NAME = 'MobileTimeNotAllowedException'

  constructor(
    message = 'This project does not allow tracking from a phone. Its owner can allow it in the project settings.',
  ) {
    super()

    Object.setPrototypeOf(this, MobileTimeNotAllowedException.prototype)
    this.name = MobileTimeNotAllowedException.NAME
    this.message = message
  }
}

export default MobileTimeNotAllowedException
