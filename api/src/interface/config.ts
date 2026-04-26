export interface IConfigParameters {
  host: string;
  port: number;
  sentry: string;
  redis: string;
  jwtSecret: string;
  database: {
    type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}
