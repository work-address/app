import { DataSource } from 'typeorm'

import { AppConfig } from '@/app/app-config'

// Consumed by the TypeORM CLI (`pnpm schema:sync` / `schema:drop`), which
// since 0.3 requires a DataSource instance rather than a plain options object.
const params = AppConfig.readConfig()

export default new DataSource({
  type: params.database.type as 'postgres',
  host: params.database.host,
  port: params.database.port,
  username: params.database.username,
  password: params.database.password,
  database: params.database.database,
  entities: ['src/entity/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: ['src/subscriber/**/*.ts'],
})
