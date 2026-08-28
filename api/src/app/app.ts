import 'reflect-metadata'
import * as http from 'http'
import * as Sentry from '@sentry/node'
import express from 'express'
import bodyParser from 'body-parser'
import { Container } from 'inversify'
import { DataSource } from 'typeorm'
import { useExpressServer } from 'routing-controllers'

import { AppContainer } from '@/app/app-container'
import { DbConnector } from '@/connector/db-connector'
import { HelpController } from '@/controller/help-controller'
import { ErrorHandler } from '@/middleware/error-handler'
import { PayloadLogger } from '@/middleware/payload-logger'
import { IConfigParameters } from '@/model/config'

import { AuthController } from '@/controller/auth-controller'
import { ValidateRoles } from '@/middleware/validate-roles'
import { UserController } from '@/controller/user-controller'
import { ProjectController } from '@/controller/project-controller'
import { TimeController } from '@/controller/time-controller'
import { InvoiceController } from '@/controller/invoice-controller'
import { EntitlementController } from '@/controller/entitlement-controller'
import { AuthTimeTrackerController } from '@/controller/auth-time-tracker-controller'

const swaggerUiExpress = require('swagger-ui-express')

export class App {
  public static server: http.Server
  public static conn: DataSource
  public static container: Container

  private readonly env: string
  private readonly parameters: IConfigParameters
  private readonly express: express.Application

  constructor(parameters: IConfigParameters, env: string) {
    this.env = env
    this.parameters = parameters
    this.express = express()
  }

  public async boostrap() {
    const dbConnector = new DbConnector(this.parameters, this.env)

    App.conn = await dbConnector.connect()
    App.container = AppContainer.build(this.parameters, this.env)
  }

  public async start(port?: number) {
    // Behind a reverse proxy (nginx in prod, vite dev-server proxy locally),
    // so derive req.ip from X-Forwarded-For instead of the socket peer
    // (which is the proxy container's docker network address, e.g. 172.19.0.2).
    this.express.set('trust proxy', true)

    this.express.use(
      bodyParser.json({
        verify: (
          req: express.Request & { rawBuffer?: string },
          _res: express.Response,
          buf: Buffer,
        ) => {
          req.rawBuffer = buf.toString()
        },
        limit: '30mb',
      }),
    )

    this.initControllers()

    // Must come after the routes so it sees errors they raise. Sentry.init()
    // itself runs in src/instrument.ts, before any instrumented module loads.
    if (this.parameters.sentry) {
      Sentry.setupExpressErrorHandler(this.express)
    }

    const swaggerNoStore: express.RequestHandler = (_req, res, next) => {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private',
      )
      next()
    }

    // Fetch spec from `/api/help/openApi` so docs stay fresh after deploy; embedding via `setup(spec)`
    // bakes JSON into HTML and is often cached by proxies/CDNs as stale schema.
    this.express.use(
      '/swagger',
      swaggerNoStore,
      swaggerUiExpress.serve,
      swaggerUiExpress.setup(null, {
        swaggerUrl: '/api/help/openApi',
      }),
    )

    await this.listen(port)
  }

  public getListeningPort(): number {
    const address = App.server.address()

    if (address && typeof address === 'object') {
      return address.port
    }

    return this.parameters.port
  }

  public async stop() {
    if (App.conn?.isInitialized) {
      await App.conn.destroy()
    }

    if (!App.server) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      App.server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  private initControllers() {
    useExpressServer(this.express, {
      defaultErrorHandler: false,
      middlewares: [ErrorHandler, PayloadLogger],
      authorizationChecker: ValidateRoles,
      cors: {
        origin: '*',
        // credentials: true,
        // preflightContinue: false,
        // optionsSuccessStatus: 204
        // methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'], // to works well with web app, OPTIONS is required
        // allowedHeaders: ['Content-Type', 'Authorization'], // allow json and token in the header
        exposedHeaders: [
          'Authorization',
          'Location',
          'Refresh-Token',
          'sentry-trace',
        ],
      },
      routePrefix: '/api',
      controllers: [
        HelpController,
        ProjectController,
        AuthController,
        AuthTimeTrackerController,
        UserController,
        TimeController,
        InvoiceController,
        EntitlementController,
      ],
    })
  }

  private listen(port?: number): Promise<void> {
    return new Promise((resolve) => {
      App.server = this.express.listen(
        port ?? this.parameters.port,
        this.parameters.host,
        () => {
          if (this.env !== 'test') {
            console.log(
              `App[${this.env}] listening on ${this.parameters.host}:${this.getListeningPort()}`,
            )
          }

          resolve()
        },
      )

      App.server.keepAliveTimeout = 65000
      App.server.headersTimeout = 66000
    })
  }
}
