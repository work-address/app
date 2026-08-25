/**
 * Raised when a time entry falls outside the retention window its project is
 * entitled to. Reported per-entry so a syncing client learns the entry was
 * refused, instead of being handed a success receipt for a row the retention
 * purge is about to remove.
 */
class RetentionExceededException extends Error {
  public static NAME = 'RetentionExceededException'

  constructor(message: string) {
    super()

    Object.setPrototypeOf(this, RetentionExceededException.prototype)
    this.name = RetentionExceededException.NAME
    this.message = message
  }
}

export default RetentionExceededException
