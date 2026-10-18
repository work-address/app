/** Recording requests never belong in telemetry payloads or exception attachments. */
export class RecordingPrivacy {
  public static ingest(value: string | undefined): boolean {
    if (!value) return false
    try {
      return /^\/api\/agent-tracking\/events\/?$/i.test(
        new URL(value, 'http://localhost').pathname,
      )
    } catch {
      return false
    }
  }
  public static sensitive(value: string | undefined): boolean {
    if (!value) return false
    try {
      return /^\/api\/(time(?:\/|$)|statistics(?:\/|$)|agents?(?:-|\/|$)|user\/settings(?:\/|$))/i.test(
        new URL(value, 'http://localhost').pathname,
      )
    } catch {
      return false
    }
  }
}
