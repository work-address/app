/**
 * Raised, per entry, when time is uploaded for a project the uploader cannot
 * track: it does not exist, was deleted or closed, or the uploader no longer
 * works on it. One name and one message for all of them, so the answer never
 * says whether a project the uploader cannot see exists, and so a client can
 * tell this refusal from any other without parsing query text.
 */
class ProjectUnavailableException extends Error {
  public static NAME = 'ProjectUnavailableException'

  constructor(
    message = 'The project is not available: it was deleted or closed, or you no longer work on it',
  ) {
    super()

    Object.setPrototypeOf(this, ProjectUnavailableException.prototype)
    this.name = ProjectUnavailableException.NAME
    this.message = message
  }
}

export default ProjectUnavailableException
