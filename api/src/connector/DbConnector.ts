import {Connection, ConnectionOptions, getConnectionManager} from 'typeorm';
import {IConfigParameters} from '../interface/IConfigParameters';

export class DbConnector {
  protected params: IConfigParameters;
  protected env: string;

  constructor(params: IConfigParameters, env: string) {
    this.params = params;
    this.env = env;
  }

  public connect(): Promise<Connection> {
    const manager = getConnectionManager();
    const directory = ['test', 'development'].includes(this.env) ? 'src' : 'build';

    const connectionConfig: ConnectionOptions = {
      type: this.params.database.type as 'postgres',
      host: this.params.database.host,
      port: this.params.database.port,
      username: this.params.database.username,
      password: this.params.database.password,
      database: this.params.database.database,
      entities: [`${directory}/entity/*`],
      migrations: [`${directory}/migrations/**/*`],
      subscribers: [`${directory}/subscriber/**/*`],
      cli: {
        entitiesDir: `${directory}/entity`,
        migrationsDir: `${directory}/migration`,
        subscribersDir: `${directory}/subscriber`,
      },
    };

    return manager.create(connectionConfig).connect();
  }
}
