import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'
import fs from 'fs'
import sharp from 'sharp'

import {
  invoiceControllerCreate,
  invoiceControllerRead,
  timeControllerCreateOrUpdateMany,
  timeControllerDelete,
} from '@app/api-client'
import type { TimeCreateDto as ApiTimeCreateDto } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { ProjectManager } from '@/service/project-manager'
import { TimeRepository } from '@/repository/time-repository'
import { TimeCreateDto } from '@/model/dto/time'
import { In } from 'typeorm'
import { join } from 'path'
import { EProjectState } from '@/model/project'
import axios from 'axios'
import { runPromise } from '@/service/effect-bridge'

@suite
export class TimeControllerCrudTest extends BaseControllerTest {
  protected timeRepository: TimeRepository
  protected projectManager: ProjectManager

  constructor() {
    super()

    this.timeRepository = this.container.get('TimeRepository')
    this.projectManager = this.container.get('ProjectManager')
  }

  /**
   * The media path, end to end: a screenshot the tracker sends is resized
   * before it is stored - 600px wide, grayscale, webp - and the response
   * never carries it back, so a tracker reconciling a batch is not handed
   * the image it just uploaded.
   */
  @test
  async createMany_storesAResizedScreenshot_andNeverEchoesItBack() {
    const original = fs.readFileSync(
      join(__dirname, '../fixture/media/screenshot.webp'),
    )
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(
      user,
      0,
      true,
      true,
    )
    const processes = [
      { name: 'Qtcreator', description: 'Editing', timeMin: 7 },
      { name: 'Dolphin', description: 'Files', timeMin: 3 },
    ]
    const toAt = moment.utc()
    const entry = {
      fromIndex: 3000,
      toIndex: 3001,
      note: faker.string.uuid(),
      keyboardKeys: 4,
      minutesActive: 5,
      mouseKeys: 3,
      mouseDistance: 2,
      fromAt: toAt.clone().subtract(10, 'minutes').toISOString(),
      toAt: toAt.toISOString(),
      projectId: project.id,
      screenshot: original.toString('base64'),
      processes,
    }

    const res = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: [entry] as unknown as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0].id).to.be.a('string')
    expect(res.data[0].screenshot).to.be.equal(undefined)
    expect(res.data[0].processes).to.be.equal(undefined)

    const stored = await runPromise(
      this.timeRepository.findOneByOrFail({
        where: { project: { id: project.id } },
      }),
    )

    expect(stored.processes).to.be.deep.equal(processes)
    expect(stored.screenshot).to.be.a('string')

    const image = await sharp(
      Buffer.from(stored.screenshot as string, 'base64'),
    ).metadata()

    expect(image.format).to.be.equal('webp')
    expect(image.width).to.be.equal(600)
    expect(
      Buffer.from(stored.screenshot as string, 'base64').length,
    ).to.be.lessThan(original.length)
  }

  /**
   * The same slice sent again is the same row, screenshot included: a tracker
   * that retries an upload must not leave the first image behind, and must
   * not create a second row for one period of work.
   */
  @test
  async createMany_replacesTheStoredScreenshotWhenTheSliceIsSentAgain() {
    const first = fs.readFileSync(
      join(__dirname, '../fixture/media/screenshot.webp'),
    )
    const second = fs.readFileSync(
      join(__dirname, '../fixture/media/screenshot_20260127_184X00.webp'),
    )
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(
      user,
      0,
      true,
      true,
    )
    const toAt = moment.utc()
    const slice = {
      fromIndex: 4000,
      toIndex: 4001,
      note: 'retried',
      keyboardKeys: 1,
      minutesActive: 5,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: toAt.clone().subtract(10, 'minutes').toISOString(),
      toAt: toAt.toISOString(),
      projectId: project.id,
    }

    const send = (screenshot: string) =>
      timeControllerCreateOrUpdateMany({
        client: this.apiClient(),
        headers: {
          Authorization: this.authenticator.getTokens(user).accessToken,
        },
        body: [{ ...slice, screenshot }] as unknown as ApiTimeCreateDto[],
        throwOnError: true,
      })

    const created = await send(first.toString('base64'))
    const storedFirst = await runPromise(
      this.timeRepository.findOneByOrFail({
        where: { project: { id: project.id } },
      }),
    )

    const updated = await send(second.toString('base64'))
    const rows = await runPromise(
      this.timeRepository.findBy({ where: { project: { id: project.id } } }),
    )

    expect(updated.data[0].id).to.be.equal(created.data[0].id)
    expect(rows).to.have.lengthOf(1)
    expect(rows[0].screenshot).to.be.a('string')
    expect(rows[0].screenshot).to.not.be.equal(storedFirst.screenshot)
  }

  /**
   * A projectId the database cannot even parse fails in its own slot, naming
   * the row it came from, while the valid row beside it is stored.
   */
  @test
  async createPersonalMalformedProjectId_isRefusedInItsOwnSlot() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const toAt = moment.utc()
    const row = (projectId: string, fromIndex: number) => ({
      fromIndex,
      toIndex: fromIndex + 1,
      note: faker.string.uuid(),
      keyboardKeys: 1,
      minutesActive: 5,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: toAt.clone().subtract(10, 'minutes').toISOString(),
      toAt: toAt.toISOString(),
      projectId,
    })
    const data = [row(project.id, 1000), row('', 2000)]

    const res = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0].id).to.be.a('string')
    expect(res.data[1].id).to.be.equal(undefined)
    expect(res.data[1].error?.name).to.be.equal('QueryFailedError')
    expect(res.data[1].note).to.be.equal(data[1].note)

    const stored = await runPromise(
      this.timeRepository.findBy({ where: { project: { id: project.id } } }),
    )

    expect(stored.map((time) => time.note)).to.be.deep.equal([data[0].note])
  }

  @test
  async createPersonalInputValidationErrorB() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user)
    const data = [
      {
        fromIndex: 1000,
        toIndex: 1001,
        fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
        toAt: moment.utc().toISOString(),
        note: faker.string.uuid(),
        projectId: projectA.id,
      },
    ]

    const client = this.apiClient()
    const res = await timeControllerCreateOrUpdateMany({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data).to.be.deep.equal([
      {
        ...data[0],
        error: {
          name: 'ConstraintsValidationException',
          message: 'Constraint validation error has occurred.',
          errors: [
            {
              property: 'keyboardKeys',
              constraints: {
                isNumber:
                  'keyboardKeys must be a number conforming to the specified constraints',
              },
              children: [],
            },
            {
              property: 'minutesActive',
              constraints: {
                isNumber:
                  'minutesActive must be a number conforming to the specified constraints',
              },
              children: [],
            },
            {
              property: 'mouseKeys',
              constraints: {
                isNumber:
                  'mouseKeys must be a number conforming to the specified constraints',
              },
              children: [],
            },
            {
              property: 'mouseDistance',
              constraints: {
                isNumber:
                  'mouseDistance must be a number conforming to the specified constraints',
              },
              children: [],
            },
          ],
        },
      },
    ])
  }

  /**
   * A row out of bounds comes back over HTTP as a validation error in its
   * own slot, naming the field, the value and the rule, while the request
   * succeeds and the row beside it is stored.
   */
  @test
  async createOutOfBoundsRow_isRefusedInItsOwnSlot() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    const toAt = moment.utc()
    const fromAt = toAt.clone().subtract(10, 'minutes')
    const row = (note: string, minutesActive: number, hoursAgo: number) => ({
      fromIndex: 1000,
      toIndex: 1001,
      note,
      keyboardKeys: 1,
      minutesActive,
      mouseKeys: 1,
      mouseDistance: 1,
      fromAt: fromAt.clone().subtract(hoursAgo, 'hours').toISOString(),
      toAt: toAt.clone().subtract(hoursAgo, 'hours').toISOString(),
      projectId: project.id,
    })
    const data = [row('valid', 10, 0), row('inflated', 11, 1)]

    const res = await timeControllerCreateOrUpdateMany({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as ApiTimeCreateDto[],
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(res.data[0].id).to.be.a('string')
    expect(res.data[1]).to.be.deep.equal({
      ...data[1],
      error: {
        name: 'ConstraintsValidationException',
        message: 'Constraint validation error has occurred.',
        errors: [
          {
            value: 11,
            property: 'minutesActive',
            constraints: {
              maxSpanMinutes:
                'minutesActive must not exceed the 10 minute(s) from fromAt to toAt',
            },
            children: [],
          },
        ],
      },
    })

    const stored = await runPromise(
      this.timeRepository.findBy({ where: { project: { id: project.id } } }),
    )

    expect(stored.map((time) => time.note)).to.be.deep.equal(['valid'])
  }

  @test
  async updatePersonal() {
    // Uses a fixed historical timestamp well outside the free-tier 7-day
    // retention window, so must be premium or the entries get purged.
    const user = await this.userFixture.createPremiumUser()
    const projectA = await this.projectFixture.createPersonal(user)
    const projectB = await this.projectFixture.createPersonal(user)

    const unix = 1705829280
    const fromAt = moment.unix(unix)
    const toAt = moment.unix(unix).add(10, 'minutes')

    await this.timeFixture.create(projectB, fromAt.toDate(), toAt.toDate())
    const data: TimeCreateDto[] = [
      {
        fromIndex: 1000,
        toIndex: 1001,
        note: faker.string.uuid(),
        keyboardKeys: faker.number.int(9),
        minutesActive: faker.number.int(9),
        mouseKeys: faker.number.int(9),
        mouseDistance: faker.number.int(9),
        fromAt: fromAt.toISOString(),
        toAt: toAt.toISOString(),
        projectId: projectA.id,
      },
      {
        fromIndex: 1000,
        toIndex: 1001,
        note: faker.string.uuid(),
        keyboardKeys: 100000,
        // Within the ten-minute slice: minutesActive is bounded by its span.
        minutesActive: 7,
        mouseKeys: 100000,
        mouseDistance: 100000,
        fromAt: fromAt.toISOString(),
        toAt: toAt.toISOString(),
        projectId: projectA.id,
      },
      {
        fromIndex: 2000,
        toIndex: 2001,
        note: faker.string.uuid(),
        keyboardKeys: 200000,
        minutesActive: 8,
        mouseKeys: 200000,
        mouseDistance: 200000,
        fromAt: fromAt.toISOString(),
        toAt: toAt.toISOString(),
        projectId: projectB.id,
      },
    ]

    const client = this.apiClient()
    const res = await timeControllerCreateOrUpdateMany({
      client,
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      body: data as unknown as ApiTimeCreateDto[],
      throwOnError: true,
    })

    const times = await runPromise(
      this.timeRepository.findBy({
        where: {
          project: In([projectA.id, projectB.id]),
        },
        order: {
          createdAt: 'ASC',
        },
      }),
    )

    expect(res.status).to.be.equal(200)
    expect(res.data).to.have.length(3)
    expect(times[0].keyboardKeys).to.eq(200000)
    expect(times[0].project.id).to.eq(projectB.id)
    expect(times[1].keyboardKeys).to.eq(100000)
    expect(times[1].project.id).to.eq(projectA.id)
  }

  /**
   * The desktop tracker sends each slice as Qt::ISODate text in UTC with no
   * zone - "2026-01-27T12:10:00" - so a zone-less timestamp is UTC. Read as
   * the server's local time, every entry moved by the server's offset on any
   * host not set to UTC: back by nine hours in Tokyo, and forward - into the
   * future, so refused - in Los Angeles. The process zone is forced here, so
   * the suite proves it on a UTC host too.
   */
  @test
  async createPersonal_readsAZonelessTimestampAsUtc() {
    const user = await this.userFixture.createUser()
    const project = await this.projectFixture.createPersonal(user)
    // One clock read; every slice is derived from it, in whole seconds as
    // the tracker writes them.
    const now = moment.utc().startOf('minute')
    const zoneless = 'YYYY-MM-DDTHH:mm:ss'
    const previousZone = process.env.TZ

    try {
      for (const [index, zone] of [
        'Asia/Tokyo',
        'America/Los_Angeles',
      ].entries()) {
        process.env.TZ = zone

        // Guard the premise: the zone took, so local time is not UTC.
        expect(now.toDate().getTimezoneOffset(), zone).to.not.eq(0)

        const toAt = now.clone().subtract(20 * index + 10, 'minutes')
        const fromAt = toAt.clone().subtract(10, 'minutes')

        const res = await timeControllerCreateOrUpdateMany({
          client: this.apiClient(),
          headers: {
            Authorization: this.authenticator.getTokens(user).accessToken,
          },
          body: [
            {
              fromIndex: index,
              toIndex: index + 1,
              note: zone,
              keyboardKeys: 1,
              minutesActive: 5,
              mouseKeys: 1,
              mouseDistance: 1,
              fromAt: fromAt.format(zoneless),
              toAt: toAt.format(zoneless),
              projectId: project.id,
            },
          ] as unknown as ApiTimeCreateDto[],
          throwOnError: true,
        })

        expect(res.data[0].error, zone).to.be.undefined

        const stored = await runPromise(
          this.timeRepository.findOneBy({ where: { id: res.data[0].id } }),
        )

        expect(stored?.fromAt.toISOString(), zone).to.eq(fromAt.toISOString())
        expect(stored?.toAt.toISOString(), zone).to.eq(toAt.toISOString())
      }
    } finally {
      if (previousZone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = previousZone
      }
    }
  }

  @test()
  async delete_asOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )
    const second = await this.timeFixture.create(
      project,
      moment.utc().subtract(180, 'minutes').toDate(),
      moment.utc().subtract(120, 'minutes').toDate(),
    )

    const res = await timeControllerDelete({
      client: this.apiClient(),
      body: { ids: [time.id, second.id] },
      headers: {
        Authorization: this.authenticator.getTokens(owner).accessToken,
      },
      throwOnError: true,
    })

    const removed = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    const removedSecond = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: second.id },
      }),
    )

    expect(res.status).to.be.equal(200)
    this.expectEmptyResponseBody(res.data)
    expect(removed).to.be.undefined
    expect(removedSecond).to.be.undefined
  }

  @test()
  async delete_deniedForNonOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const other = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
    )

    let error: unknown

    try {
      await timeControllerDelete({
        client: this.apiClient(),
        body: { ids: [time.id] },
        headers: {
          Authorization: this.authenticator.getTokens(other).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error).to.be.ok
    expect(error.response?.status).to.be.equal(403)

    const stillThere = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(stillThere).to.not.eq(undefined)
  }

  @test()
  async delete_deniedForOwnerWhenNotAuthor() {
    const owner = await this.userFixture.createPremiumUser()
    const worker = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const time = await this.timeFixture.create(
      project,
      moment.utc().subtract(60, 'minutes').toDate(),
      moment.utc().toDate(),
      worker,
    )

    let error: unknown

    try {
      await timeControllerDelete({
        client: this.apiClient(),
        body: { ids: [time.id] },
        headers: {
          Authorization: this.authenticator.getTokens(owner).accessToken,
        },
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(403)

    const stillThere = await runPromise(
      this.timeRepository.findOneBy({
        where: { id: time.id },
      }),
    )
    expect(stillThere).to.not.eq(undefined)
  }

  /**
   * DEC-04: an issued invoice is a record of money owed for specific hours,
   * so an hour it bills cannot be deleted from under it. One invoiced entry
   * refuses the whole request with a 409 naming the invoice - the uninvoiced
   * entry sent with it survives too - and the invoice still reads whole.
   */
  @test()
  async delete_invoicedEntry_isRefusedWholeWith409NamingTheInvoice() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const now = moment.utc()
    const invoiced = await this.timeFixture.create(
      project,
      now.clone().subtract(180, 'minutes').toDate(),
      now.clone().subtract(170, 'minutes').toDate(),
    )
    const free = await this.timeFixture.create(
      project,
      now.clone().subtract(60, 'minutes').toDate(),
      now.clone().subtract(50, 'minutes').toDate(),
    )
    const headers = {
      Authorization: this.authenticator.getTokens(owner).accessToken,
    }

    const invoice = await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers,
      body: { timeIds: [invoiced.id] },
      throwOnError: true,
    })

    let error: unknown

    try {
      await timeControllerDelete({
        client: this.apiClient(),
        body: { ids: [free.id, invoiced.id] },
        headers,
        throwOnError: true,
      })
    } catch (e: unknown) {
      error = e
    }

    if (!axios.isAxiosError(error)) throw error
    expect(error.response?.status).to.be.equal(409)
    expect(error.response?.data?.message).to.contain(invoice.data.id)

    for (const id of [invoiced.id, free.id]) {
      const stillThere = await runPromise(
        this.timeRepository.findOneBy({ where: { id } }),
      )

      expect(stillThere, id).to.not.eq(undefined)
    }

    const read = await invoiceControllerRead({
      client: this.apiClient(),
      path: { id: invoice.data.id as never },
      headers,
      throwOnError: true,
    })

    expect(read.data.time?.map((time) => time.id)).to.deep.eq([invoiced.id])
    expect(read.data.lines?.map((line) => line.timeId)).to.deep.eq([
      invoiced.id,
    ])
  }

  /** Time no invoice bills is still the author's to delete. */
  @test()
  async delete_uninvoicedEntryBesideAnInvoicedOne_isAllowed() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.createPersonal(owner, 20)
    const now = moment.utc()
    const invoiced = await this.timeFixture.create(
      project,
      now.clone().subtract(180, 'minutes').toDate(),
      now.clone().subtract(170, 'minutes').toDate(),
    )
    const free = await this.timeFixture.create(
      project,
      now.clone().subtract(60, 'minutes').toDate(),
      now.clone().subtract(50, 'minutes').toDate(),
    )
    const headers = {
      Authorization: this.authenticator.getTokens(owner).accessToken,
    }

    await invoiceControllerCreate({
      client: this.apiClient(),
      path: { projectId: project.id as never },
      headers,
      body: { timeIds: [invoiced.id] },
      throwOnError: true,
    })

    const res = await timeControllerDelete({
      client: this.apiClient(),
      body: { ids: [free.id] },
      headers,
      throwOnError: true,
    })

    expect(res.status).to.be.equal(200)
    expect(
      await runPromise(
        this.timeRepository.findOneBy({ where: { id: free.id } }),
      ),
    ).to.be.undefined
    expect(
      await runPromise(
        this.timeRepository.findOneBy({ where: { id: invoiced.id } }),
      ),
    ).to.not.eq(undefined)
  }
}
