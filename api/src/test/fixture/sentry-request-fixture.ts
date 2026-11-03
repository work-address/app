import * as Sentry from '@sentry/node'

import { SentryRequestPolicy } from '../../service/sentry-request-policy'

class SentryRequestFixture {
  public static async run(): Promise<void> {
    const events: Sentry.Event[] = []
    const envelopes: string[] = []

    Sentry.init({
      dsn: 'http://public@localhost/1',
      tracesSampleRate: 1.0,
      defaultIntegrations: false,
      integrations: [
        Sentry.httpIntegration({
          ignoreIncomingRequestBody: SentryRequestPolicy.omitAuthBody,
          trackIncomingRequestsAsSessions: false,
        }),
        Sentry.expressIntegration(),
        Sentry.requestDataIntegration(),
      ],
      transport: () => ({
        send: async (envelope) => {
          envelopes.push(JSON.stringify(envelope))
          for (const [header, payload] of envelope[1]) {
            if (header.type === 'event') events.push(payload as Sentry.Event)
          }
          return {}
        },
        flush: async () => true,
      }),
    })

    // These imports deliberately happen after SDK initialization, matching
    // the real server entrypoint's required instrumentation order.
    const express: typeof import('express') = require('express')
    const http: typeof import('node:http') = require('node:http')
    const app = express()
    app.use(express.json())
    app.post(['/api/auth/google', '/api/user'], (request, response) => {
      Sentry.captureException(new Error(`fixture ${request.path}`))
      response.status(200).end()
    })
    Sentry.setupExpressErrorHandler(app)

    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Fixture server did not bind')
    }

    try {
      for (const [endpoint, body] of [
        ['/api/auth/google', { credential: 'private-google-credential' }],
        ['/api/user', { name: 'public-profile-name' }],
      ] as const) {
        await new Promise<void>((resolve, reject) => {
          const request = http.request(
            {
              host: '127.0.0.1',
              port: address.port,
              path: endpoint,
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            },
            (response) => {
              response.resume()
              response.once('end', resolve)
              response.once('error', reject)
            },
          )
          request.once('error', reject)
          request.end(JSON.stringify(body))
        })
      }

      await Sentry.flush(2000)
      const authEvent = events.find((event) =>
        event.request?.url?.endsWith('/api/auth/google'),
      )
      const profileEvent = events.find((event) =>
        event.request?.url?.endsWith('/api/user'),
      )
      if (!authEvent || authEvent.request?.data !== undefined) {
        throw new Error('Authentication request body reached Sentry')
      }
      if (
        envelopes.some((envelope) =>
          envelope.includes('private-google-credential'),
        )
      ) {
        throw new Error('Credential appeared in a Sentry envelope')
      }
      if (
        !JSON.stringify(profileEvent?.request?.data).includes(
          'public-profile-name',
        )
      ) {
        throw new Error('Non-authentication request body was not captured')
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await Sentry.close(2000)
    }

    console.log('Sentry request capture passed')
  }
}

SentryRequestFixture.run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
