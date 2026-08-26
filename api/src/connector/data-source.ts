import { DataSource } from 'typeorm'

// TypeORM 0.3 removed the global connection registry (getConnection /
// getConnectionManager / getRepository). Repositories and constraints still
// need ambient access to the active connection, so the process-wide DataSource
// lives here and DbConnector owns setting it.
let dataSource: DataSource | undefined

export function setDataSource(source: DataSource): void {
  dataSource = source
}

export function findDataSource(): DataSource | undefined {
  return dataSource
}

export function getDataSource(): DataSource {
  if (!dataSource) {
    throw new Error('DataSource has not been created yet')
  }

  return dataSource
}
