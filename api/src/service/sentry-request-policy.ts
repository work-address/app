/** Pure policy: safe to import before HTTP and framework instrumentation. */
export class SentryRequestPolicy {
  public static omitAuthBody(url: string): boolean {
    try {
      const path = new URL(url, 'http://localhost').pathname
      return /^\/api\/auth(?:\/|$)/i.test(path)
    } catch {
      return false
    }
  }
}
