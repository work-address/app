// Sentry's Node SDK auto-instruments http/express via OpenTelemetry, which
// requires init() to run before those modules are imported. Keep this module
// free of app imports beyond config, and import it first from the entrypoint.
import * as Sentry from '@sentry/node'

import { AppConfig } from '@/app/app-config'

const parameters = AppConfig.readConfig()

if (parameters.sentry) {
  Sentry.init({
    dsn: parameters.sentry,
    environment: AppConfig.getEnv(),
    tracesSampleRate: 1.0,
  })
}
