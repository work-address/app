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
import { AppConfig } from '@/app/app-config'
import { InvoiceScheduler } from '@/service/invoice-scheduler'
import { RetentionJob } from '@/service/retention-job'

import { AuthController } from '@/controller/auth-controller'
import { ValidateRoles } from '@/middleware/validate-roles'
import { UserController } from '@/controller/user-controller'
import { IdentityController } from '@/controller/identity-controller'
import { ProjectController } from '@/controller/project-controller'
import { TimeController } from '@/controller/time-controller'
import { InvoiceController } from '@/controller/invoice-controller'
import { EntitlementController } from '@/controller/entitlement-controller'
import { MarketplaceHireController } from '@/controller/marketplace-hire-controller'
import { MarketplaceSettlementController } from '@/controller/marketplace-settlement-controller'
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
    this.startInvoiceScheduler()
    this.startRetentionJob()

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

  /**
   * Arms the weekly invoice schedule, once the container and the database are
   * up.
   *
   * Not in test: the suite drives the scheduler directly with a fixed clock,
   * and a timer firing between cases would raise invoices no test asked for
   * against the same database.
   */
  private startInvoiceScheduler() {
    if (AppConfig.isTest()) {
      return
    }

    App.container.get<InvoiceScheduler>('InvoiceScheduler').start()
  }

  /**
   * Arms the daily retention run (DEC-05). The job itself declines on a
   * self-hosted instance, which has no free tier to rotate. Not in test, for
   * the scheduler's reason: the suite runs the job directly with its own
   * clock.
   */
  private startRetentionJob() {
    if (AppConfig.isTest()) {
      return
    }

    App.container.get<RetentionJob>('RetentionJob').start()
  }

  public async stop() {
    if (App.container?.isBound('InvoiceScheduler')) {
      App.container.get<InvoiceScheduler>('InvoiceScheduler').stop()
    }

    if (App.container?.isBound('RetentionJob')) {
      App.container.get<RetentionJob>('RetentionJob').stop()
    }

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
        IdentityController,
        TimeController,
        InvoiceController,
        EntitlementController,
        MarketplaceHireController,
        MarketplaceSettlementController,
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
