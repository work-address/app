import { DataSource, DataSourceOptions } from 'typeorm'
import { IConfigParameters } from '@/model/config'
import { findDataSource, setDataSource } from '@/connector/data-source'

/**
 * Tests synchronize and drop their schema on every run, so they get a
 * database of their own, and a server never uses one: a development API
 * pointed at the test database lost its data whenever the tests ran.
 */
export function checkDatabaseForEnv(env: string, database: string) {
  const forTests = /_test$/i.test(database)
  if (env === 'test' && !forTests)
    throw new Error(
      `Tests drop their database; "${database}" must end with _test (APP_DB_NAME in .env.test)`,
    )
  if (env !== 'test' && forTests)
    throw new Error(
      `"${database}" is the tests' database, which they drop; use another APP_DB_NAME for ${env}`,
    )
}

export class DbConnector {
  protected params: IConfigParameters
  protected env: string

  constructor(params: IConfigParameters, env: string) {
    this.params = params
    this.env = env
  }

  public connect(): Promise<DataSource> {
    const existing = findDataSource()

    if (existing) {
      if (existing.isInitialized) {
        return Promise.resolve(existing)
      }

      return existing.initialize()
    }

    checkDatabaseForEnv(this.env, this.params.database.database)
    const fromSource = ['test', 'development'].includes(this.env)
    const directory = fromSource ? 'src' : 'build'
    // Match on the emitted extension so the globs cannot pick up sourcemaps
    // or the declaration files that `composite: true` writes into build/.
    const extension = fromSource ? 'ts' : 'js'

    const connectionConfig: DataSourceOptions = {
      type: this.params.database.type as 'postgres',
      host: this.params.database.host,
      port: this.params.database.port,
      username: this.params.database.username,
      password: this.params.database.password,
      database: this.params.database.database,
      entities: [`${directory}/entity/*.${extension}`],
      migrations: [`${directory}/migrations/**/*.${extension}`],
      subscribers: [`${directory}/subscriber/**/*.${extension}`],
      synchronize: this.env === 'test',
      dropSchema: this.env === 'test',
    }

    const dataSource = new DataSource(connectionConfig)
    setDataSource(dataSource)

    return dataSource.initialize()
  }
}
