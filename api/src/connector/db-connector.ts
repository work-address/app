import { DataSource, DataSourceOptions } from 'typeorm'
import { IConfigParameters } from '@/model/config'
import { findDataSource, setDataSource } from '@/connector/data-source'

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
