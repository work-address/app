import { Time } from '@/entity/time'
import { User } from '@/entity/user'

export class TimeVisibility {
  public static screenshotRetainedSql(): string {
    return `(project."screenshotRetentionDays" IS NULL OR time."toAt" + project."screenshotRetentionDays" * INTERVAL '1 day' > NOW())`
  }
  public static detailSql(): string {
    return `(time."userId"=:detailUser OR (project."userId"=:detailUser AND
      (time."publishedAt" IS NOT NULL OR time."invoiceId" IS NOT NULL OR
       time."toAt" + project."reviewWindowHours" * INTERVAL '1 hour' <= NOW())))`
  }
  public static published(time: Time, now = Date.now()): boolean {
    return Boolean(
      time.publishedAt ||
        time.invoice ||
        new Date(time.toAt).getTime() +
          (time.project?.reviewWindowHours ?? 24) * 3600_000 <=
          now,
    )
  }
  public static detail(time: Time, user: User, now = Date.now()): boolean {
    return (
      time.user?.id === user.id ||
      (time.project?.user?.id === user.id && this.published(time, now))
    )
  }
  public static redact(time: Time, user: User): Time {
    if (!this.detail(time, user)) {
      time.note = null
      time.minutesActive = null
      time.keyboardKeys = null
      time.mouseKeys = null
      time.mouseDistance = null
      time.screenshot = null
      time.processes = null
      time.apps = undefined
      time.appsReason = null
      time.detailPendingReview =
        time.project?.user?.id === user.id && !this.published(time)
    }
    if (
      time.project?.screenshotRetentionDays &&
      new Date(time.toAt).getTime() +
        time.project.screenshotRetentionDays * 86400_000 <=
        Date.now()
    )
      time.screenshot = null
    return time
  }
}
