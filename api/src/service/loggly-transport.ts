import https from 'https'
import TransportStream from 'winston-transport'

export interface LogglyTransportOptions
  extends TransportStream.TransportStreamOptions {
  token: string
  tags?: string[]
}

/**
 * Minimal Winston transport that POSTs JSON events to Loggly's HTTP input API.
 * Avoids winston-loggly-bulk / node-loggly-bulk (axios `uri` quirks, silent bulk buffering).
 */
export class LogglyTransport extends TransportStream {
  private readonly token: string
  private readonly tags: string[]

  constructor(options: LogglyTransportOptions) {
    super(options)
    this.token = options.token
    this.tags = (options.tags ?? []).filter((tag) => tag.length > 0)
  }

  log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => this.emit('logged', info))

    const payload = JSON.stringify(this.sanitize(info))
    const tagPath =
      this.tags.length > 0
        ? `/tag/${this.tags.map(encodeURIComponent).join(',')}`
        : ''

    const req = https.request(
      {
        hostname: 'logs-01.loggly.com',
        path: `/inputs/${this.token}${tagPath}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 400) {
          console.error(
            `LogglyTransport HTTP ${res.statusCode} for ${String(
              info.message ?? '',
            )}`,
          )
        }
      },
    )

    req.on('error', (error) => {
      console.error('LogglyTransport request failed', error.message)
    })

    req.write(payload)
    req.end()
    callback()
  }

  private sanitize(info: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(info)) {
      if (
        key === 'level' ||
        key === 'message' ||
        key === 'timestamp' ||
        key === 'splat'
      ) {
        out[key] = value
        continue
      }
      out[key] = value
    }
    return out
  }
}
