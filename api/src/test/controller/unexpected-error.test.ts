import { suite, test } from '@testdeck/mocha'
import axios from 'axios'
import { expect } from 'chai'
import { Effect } from 'effect'
import { InternalServerError } from 'routing-controllers'
import { QueryFailedError } from 'typeorm'

import { App } from '@/app/app'
import AccessException from '@/exception/access-exception'
import GoogleUnavailableException from '@/exception/google-unavailable-exception'
import ProjectUnavailableException from '@/exception/project-unavailable-exception'
import RetentionExceededException from '@/exception/retention-exceeded-exception'
import { User } from '@/entity/user'
import { ILogger } from '@/model/logging'
import { TimeRepository } from '@/repository/time-repository'
import { ErrorFormatter } from '@/service/error-formatter'
import { BaseControllerTest } from '@/test/controller/base-controller.test'

const GENERIC = {
  name: 'InternalServerError',
  message: 'Something went wrong on the server',
}

/** What a database failure carries, none of which may leave the server. */
const queryFailure = () =>
  new QueryFailedError(
    'INSERT INTO "time" ("note") VALUES ($1)',
    ['a private note'],
    Object.assign(
      new Error('column "secret_column" rejected "a private value"'),
      { code: '22P02' },
    ),
  )

@suite
export class UnexpectedErrorTest extends BaseControllerTest {
  private client(user: User) {
    return axios.create({
      baseURL: `${this.url}/api`,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      validateStatus: () => true,
    })
  }

  /** Runs `act` with what the logger is told at error level collected. */
  private async logged(act: () => Promise<void>) {
    const logger = App.container.get<ILogger>('ILogger')
    const original = logger.error
    const entries: { message: string; data: unknown }[] = []
    logger.error = (message, data) => {
      entries.push({ message, data })
    }
    try {
      await act()
    } finally {
      logger.error = original
    }
    return entries
  }

  /**
   * A malformed id reaches Postgres as it stands, on a route that holds no
   * recording, so the real driver error goes through the real handler.
   */
  @test
  async aDatabaseError_answersGenerically_andLogsTheDetail() {
    const user = await this.userFixture.createUser()
    let response: { status: number; data: unknown } | undefined
    const entries = await this.logged(async () => {
      response = await this.client(user).get('/project/not-a-uuid')
    })

    expect(response?.status).to.equal(500)
    expect(response?.data).to.deep.equal(GENERIC)
    expect(JSON.stringify(response?.data)).to.not.match(/uuid|not-a-uuid/)

    const [entry] = entries
    expect(entries.length).to.equal(1)
    const logged = entry.data as {
      url: string
      error: { name: string; code: string; message: string }
    }
    expect(logged.url).to.equal('/api/project/not-a-uuid')
    expect(logged.error.name).to.equal('QueryFailedError')
    expect(logged.error.code).to.equal('22P02')
    expect(logged.error.message).to.match(/invalid input syntax/)
    expect(JSON.stringify(entry.data)).to.not.match(/"(query|parameters)"/)
  }

  /** On a recording route the log leaves out what could quote a value. */
  @test
  async aDatabaseErrorOnARecordingRoute_logsNoText() {
    const user = await this.userFixture.createUser()
    let response: { status: number; data: unknown } | undefined
    const entries = await this.logged(async () => {
      response = await this.client(user).get('/time/not-a-uuid')
    })

    expect(response?.status).to.equal(500)
    expect(response?.data).to.deep.equal(GENERIC)
    expect(entries.length).to.equal(1)
    expect((entries[0].data as { error: unknown }).error).to.deep.equal({
      name: 'QueryFailedError',
      code: '22P02',
    })
  }

  @test
  async aRefusal_keepsItsMessageAndIsNotLoggedAsUnexpected() {
    const user = await this.userFixture.createUser()
    let refused: { status: number; data: { message: string } } | undefined
    let missing: { status: number; data: { name: string } } | undefined
    let invalid: { status: number; data: { errors: unknown[] } } | undefined
    let malformed: { status: number; data: { message: string } } | undefined
    const entries = await this.logged(async () => {
      refused = await this.client(user).post('/time/search', {
        filter: {},
        sort: { nonexistent: 'ASC' },
        page: 0,
      })
      missing = await this.client(user).get(
        '/project/00000000-0000-4000-8000-000000000000',
      )
      invalid = await this.client(user).post('/time/search', {
        filter: {},
        sort: { createdAt: 'DOWN' },
        page: 0,
      })
      malformed = await this.client(user).post('/project/search', '{"page":', {
        headers: { 'content-type': 'application/json' },
      })
    })

    expect(refused?.status).to.equal(400)
    expect(refused?.data.message).to.equal(
      'Cannot sort time entries by nonexistent',
    )
    expect(missing?.status).to.equal(404)
    expect(missing?.data.name).to.equal('NotFoundError')
    expect(invalid?.status).to.equal(400)
    expect(invalid?.data.errors).to.be.an('array').that.is.not.empty
    expect(malformed?.status).to.equal(400)
    expect(malformed?.data.message).to.not.equal(GENERIC.message)
    expect(entries).to.deep.equal([])
  }

  /** One entry failing is a row in a 200, so the handler never sees it. */
  @test
  async anUploadedEntry_reportsADatabaseErrorGenerically_andLogsNoText() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const saveWithUsage = TimeRepository.prototype.saveWithUsage
    TimeRepository.prototype.saveWithUsage = () => Effect.fail(queryFailure())
    const end = Date.now() - 60_000
    let response: { status: number; data: { error: unknown }[] } | undefined
    let entries: { message: string; data: unknown }[] = []
    try {
      entries = await this.logged(async () => {
        response = await this.client(user).post('/time', [
          {
            fromIndex: 1,
            toIndex: 2,
            note: 'a private note',
            keyboardKeys: 1,
            minutesActive: 1,
            mouseKeys: 1,
            mouseDistance: 1,
            fromAt: new Date(end - 600_000).toISOString(),
            toAt: new Date(end).toISOString(),
            projectId: project.id,
          },
        ])
      })
    } finally {
      TimeRepository.prototype.saveWithUsage = saveWithUsage
    }

    expect(response?.status).to.equal(200)
    expect(response?.data[0].error).to.deep.equal(GENERIC)
    expect(entries.length).to.equal(1)
    expect((entries[0].data as { error: unknown }).error).to.deep.equal({
      name: 'QueryFailedError',
      code: '22P02',
    })
    expect(JSON.stringify(entries)).to.not.match(
      /secret_column|private|INSERT|\$1/,
    )
  }

  @test
  format_keepsWhatWasRaisedForTheClient() {
    for (const error of [
      new AccessException(),
      new GoogleUnavailableException(),
      new InternalServerError('Raised on purpose'),
      new ProjectUnavailableException(),
      new RetentionExceededException('Before the retention window'),
    ]) {
      expect(ErrorFormatter.format(error), error.name).to.deep.equal({
        name: error.name,
        message: error.message,
      })
    }
  }

  @test
  format_hidesWhatWasNot() {
    for (const error of [
      queryFailure(),
      new Error('AGENT_NOT_ATTACHED'),
      // A failed call to another service carries that service's status.
      Object.assign(new Error('Request failed'), {
        response: { status: 404 },
      }),
      Object.assign(new Error('Server trouble'), { status: 503 }),
      Object.assign(new Error('Nested'), { errors: [new Error('Inner')] }),
      'a thrown string',
    ]) {
      expect(ErrorFormatter.format(error)).to.deep.equal(GENERIC)
    }
  }
}
