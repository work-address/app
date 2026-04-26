import 'reflect-metadata';
import * as http from 'http';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import express from 'express';
import bodyParser from 'body-parser';
import {Container} from 'inversify';
import {Connection} from 'typeorm';
import {useExpressServer} from 'routing-controllers';

import {AppContainer} from './app-container';
import {DbConnector} from '../connector/db-connector';
import {OpenApi} from '../service/open-api';

import {HelpController} from '../controller/help-controller';
import {ErrorHandler} from '../middleware/error-handler';
import {AppConfig} from './app-config';
import {IConfigParameters} from '../interface/config';

import {AuthController} from '../controller/auth-controller';
import {ValidateRoles} from '../middleware/validate-roles';
import {UserController} from '../controller/user-controller';
import {ProjectController} from '../controller/project-controller';
import {TimeController} from '../controller/time-controller';
import {InvoiceController} from '../controller/invoice-controller';
import {AuthTimeTrackerController} from '../controller/auth-time-tracker-controller';

const swaggerUiExpress = require('swagger-ui-express');
const boolParser = require('express-query-boolean');

export class App {
  public static server: http.Server;
  public static conn: Connection;
  public static container: Container;

  private readonly env: string;
  private readonly parameters: IConfigParameters;
  private readonly express: express.Application;

  constructor(parameters: IConfigParameters, env: string) {
    this.env = env;
    this.parameters = parameters;
    this.express = express();
  }

  public async boostrap() {
    const dbConnector = new DbConnector(this.parameters, this.env);

    App.conn = await dbConnector.connect();
    App.container = AppContainer.build(this.parameters, this.env);
  }

  public start() {
    const openApi = new OpenApi();
    const spec = openApi.buildSpec();

    if (!AppConfig.isLocal()) {
      Sentry.init({
        dsn: this.parameters.sentry,
        integrations: [
          new Sentry.Integrations.Http({tracing: true}),
          new Tracing.Integrations.Express({app: this.express}),
        ],
        environment: this.env,
        tracesSampleRate: 1.0,
      });
      this.express.use(Sentry.Handlers.requestHandler() as express.RequestHandler);
      this.express.use(Sentry.Handlers.tracingHandler());
      this.express.use(
        Sentry.Handlers.errorHandler({
          shouldHandleError() {
            // Capture All
            // console.log('-----> error', error.message);

            return true;
          },
        }) as express.ErrorRequestHandler
      );
    }

    this.express.use(
      bodyParser.json({
        verify: (req: any, _res, buf) => {
          req.rawBuffer = buf.toString();
        },
        limit: '30mb',
      })
    );

    this.express.use(boolParser());

    this.initControllers();

    this.express.use('/swagger', swaggerUiExpress.serve, swaggerUiExpress.setup(spec));

    this.listen();
  }

  public async stop() {
    await App.conn.close();

    App.server.close();
  }

  private initControllers() {
    useExpressServer(this.express, {
      defaultErrorHandler: false,
      middlewares: [ErrorHandler],
      authorizationChecker: ValidateRoles,
      cors: {
        origin: '*',
        // credentials: true,
        // preflightContinue: false,
        // optionsSuccessStatus: 204
        // methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'], // to works well with web app, OPTIONS is required
        // allowedHeaders: ['Content-Type', 'Authorization'], // allow json and token in the header
        exposedHeaders: ['Authorization', 'Location', 'Refresh-Token', 'sentry-trace'],
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
      ],
    });
  }

  private listen() {
    App.server = this.express.listen(this.parameters.port, this.parameters.host, () => {
      if (this.env !== 'test') {
        console.log(
          `App[${this.env}] listening on ${this.parameters.host}:${this.parameters.port}`
        );
      }
    });

    App.server.keepAliveTimeout = 65000;
    App.server.headersTimeout = 66000;
  }
}
