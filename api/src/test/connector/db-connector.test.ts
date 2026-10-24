import { expect } from 'chai'
import { checkDatabaseForEnv } from '@/connector/db-connector'

describe('checkDatabaseForEnv', () => {
  it('keeps the database that tests drop away from servers', () => {
    expect(() =>
      checkDatabaseForEnv('development', 'address_work_test'),
    ).to.throw(/tests' database/)
    expect(() => checkDatabaseForEnv('production', 'wa_TEST')).to.throw(
      /tests' database/,
    )
    expect(() =>
      checkDatabaseForEnv('development', 'address_work'),
    ).not.to.throw()
    expect(() =>
      checkDatabaseForEnv('production', 'address_work'),
    ).not.to.throw()
  })
  it('lets tests drop only a database named for them', () => {
    expect(() => checkDatabaseForEnv('test', 'address_work')).to.throw(
      /must end with _test/,
    )
    expect(() =>
      checkDatabaseForEnv('test', 'address_work_test'),
    ).not.to.throw()
    expect(() => checkDatabaseForEnv('test', 'wa_test')).not.to.throw()
  })
})
