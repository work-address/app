import {AppConfig} from './app/AppConfig';

export default (() => {
  const params = AppConfig.readConfig();

  const connectionConfig = {
    type: params.database.type,
    host: params.database.host,
    port: params.database.port,
    username: params.database.username,
    password: params.database.password,
    database: params.database.database,
    entities: [`src/entity/*`],
    migrations: [`src/migrations/**/*`],
    subscribers: [`src/subscriber/**/*`],
    cli: {
      entitiesDir: `src/entity`,
      migrationsDir: `src/migration`,
      subscribersDir: `src/subscriber`,
    },
  };

  return connectionConfig;
})();
