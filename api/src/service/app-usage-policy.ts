import { createHash } from 'node:crypto'
import { domainToASCII } from 'node:url'
import { isIP } from 'node:net'
import { Project } from '@/entity/project'
import { TimeCreateDto } from '@/model/dto/time'

export interface UsageRow {
  identity: string
  app: string
  title: string | null
  domain: string | null
  seconds: number
}
export interface UsageResult {
  status: string | null
  reason: string | null
  truncated: boolean
  rows: UsageRow[]
}
export class AppUsagePolicy {
  public static normalize(input: TimeCreateDto, project: Project): UsageResult {
    const empty = { reason: null, truncated: false, rows: [] }
    if (!project.trackProcesses) return { ...empty, status: 'off' }
    if (input.appsStatus === undefined) return { ...empty, status: null }
    try {
      const statuses = [
        'ok',
        'partial',
        'off',
        'permission_missing',
        'unsupported',
        'error',
      ]
      if (!statuses.includes(input.appsStatus as string)) throw Error()
      if (
        input.appsTruncated !== undefined &&
        typeof input.appsTruncated !== 'boolean'
      )
        throw Error()
      const reason = input.appsReason == null ? null : String(input.appsReason)
      if (reason !== null && !/^[a-zA-Z0-9_:-]{1,100}$/.test(reason))
        throw Error()
      const apps = input.apps ?? []
      if (!Array.isArray(apps) || apps.length > 30) throw Error()
      if (input.appsStatus === 'off' && apps.length) throw Error()
      const rows = new Map<string, UsageRow>()
      let total = 0
      const add = (
        app: string,
        title: string | null,
        domain: string | null,
        seconds: number,
      ) => {
        if (!seconds) return
        const identity = createHash('sha256')
          .update(JSON.stringify([app, title, domain]))
          .digest('hex')
        const previous = rows.get(identity)
        rows.set(identity, {
          identity,
          app,
          title,
          domain,
          seconds: seconds + (previous?.seconds ?? 0),
        })
      }
      for (const value of apps) {
        const app = value as Record<string, unknown>
        if (
          !app ||
          typeof app !== 'object' ||
          typeof app.name !== 'string' ||
          !app.name.trim() ||
          app.name.length > 200 ||
          !this.seconds(app.seconds)
        )
          throw Error()
        total += app.seconds as number
        // Disabled details are discarded before validation; they cannot reject otherwise valid app time.
        const titles =
          project.trackWindowTitles || project.trackBrowserDomains
            ? (app.titles ?? [])
            : []
        if (!Array.isArray(titles) || titles.length > 20) throw Error()
        let detailed = 0
        for (const value of titles) {
          const item = value as Record<string, unknown>
          if (!item || typeof item !== 'object' || !this.seconds(item.seconds))
            throw Error()
          let title: string | null = null
          if (project.trackWindowTitles && item.title != null) {
            if (typeof item.title !== 'string' || item.title.length > 200)
              throw Error()
            title = item.title.trim() || null
          }
          const domain =
            project.trackBrowserDomains && item.title !== 'Private browsing'
              ? this.domain(item.domain)
              : null
          detailed += item.seconds as number
          add(app.name.trim(), title, domain, item.seconds as number)
        }
        if (detailed > (app.seconds as number)) throw Error()
        add(app.name.trim(), null, null, (app.seconds as number) - detailed)
      }
      const tracked = Math.max(
        0,
        (Date.parse(input.toAt) - Date.parse(input.fromAt)) / 1000,
      )
      const active = Math.min(tracked, Math.max(0, input.minutesActive * 60))
      if (!Number.isFinite(active) || total > active) throw Error()
      return {
        status:
          total < active && input.appsStatus === 'ok'
            ? 'partial'
            : (input.appsStatus as string),
        reason,
        truncated: input.appsTruncated === true,
        rows: [...rows.values()],
      }
    } catch {
      return { ...empty, status: 'invalid', reason: 'invalid_app_data' }
    }
  }
  private static seconds(value: unknown): boolean {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  }
  private static domain(value: unknown): string | null {
    if (value == null || value === '') return null
    if (
      typeof value !== 'string' ||
      value.length > 253 ||
      /[\s/?#@]/.test(value)
    )
      throw Error()
    const host = value.toLowerCase().replace(/\.$/, '')
    if (
      host === 'local' ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      isIP(host) ||
      isIP(host.replace(/^\[|\]$/g, ''))
    )
      return 'local'
    const ascii = domainToASCII(host)
    if (
      !ascii ||
      ascii.length > 253 ||
      !ascii
        .split('.')
        .every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))
    )
      throw Error()
    return ascii
  }
}
