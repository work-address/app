import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import { suite, test } from '@testdeck/mocha'
import moment from 'moment'
import fs from 'fs'

import {
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

  @test.skip
  async _skipped() {
    // const file = join(__dirname, '../fixture/media/screenshot.webp');
    const file = join(__dirname, '../fixture/media/screenshot.base64')
    const stream = fs.readFileSync(file)

    // console.log(stream.length)

    const client = this.apiClient()
    const res = await timeControllerCreateOrUpdateMany({
      client,
      headers: {
        'Content-Type': 'application/json',
        // Authorization: this.authenticator.getTokens(user).accessToken,
        Authorization:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBhZmRjZGYzLTQyZmYtNGEzNS05MWZhLWVkOGE1Mzc2YzFlYyIsImFkZHJlc3MiOiJVUUJLWFJrakpFc0toRnA3WFlvcF9XVkxXaXA2QXpIT1dYNUVXNWpkSTZ0QUpRWkoiLCJlbWFpbE9yUGhvbmUiOm51bGwsImlhdCI6MTc2NTE4NzEwOSwiZXhwIjoxNzY2OTE1MTA5fQ.AtXIVuwaBs-1iABXAHKHbfcIRuLWj5Rp0Dgog5Ja7RU',
      },
      body: [
        {
          fromIndex: 1000,
          toIndex: 1001,
          note: 'SCREENSHOT TEST',
          keyboardKeys: faker.number.int(9),
          minutesActive: faker.number.int(9),
          mouseKeys: faker.number.int(9),
          mouseDistance: faker.number.int(9),
          fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
          toAt: moment.utc().toISOString(),
          projectId: 'd650ad83-eab3-4200-9bf2-479a47c59892',
          // TODO: use image from the test assets
          screenshot: stream.toString(),
          processes: [
            {
              name: faker.string.uuid(),
              description: faker.string.uuid(),
              timeMin: faker.number.int(9),
            },
          ],
        },
      ] as ApiTimeCreateDto[],
      throwOnError: true,
    })

    console.log(res.data)
  }

  @test.skip
  async createPersonalManyWebp() {
    // const file = join(__dirname, '../fixture/media/screenshot.webp');
    // const file = join(__dirname, '../fixture/media/screenshor-a.webp');
    // const file = join(__dirname, '../fixture/media/screenshot.base64');
    const file = join(__dirname, '../fixture/media/screenshot.webp')
    const stream = fs.readFileSync(file)

    const user = await this.userFixture.createUser()
    // const projectA = await this.projectFixture.createPersonal(user);
    // const projectB = await this.projectFixture.createPersonal(user);
    const projectC = await this.projectFixture.createPersonal(
      user,
      0,
      true,
      true,
    )

    const data: TimeCreateDto[] = [
      // {
      //   fromIndex: 1000,
      //   toIndex: 1001,
      //   note: faker.string.uuid(),
      //   keyboardKeys: faker.number.int(9),
      //   minutesActive: faker.number.int(9),
      //   mouseKeys: faker.number.int(9),
      //   mouseDistance: faker.number.int(9),
      //   fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
      //   toAt: moment.utc().toISOString(),
      //   projectId: projectA.id,
      // },
      // {
      //   fromIndex: 2000,
      //   toIndex: 2001,
      //   note: faker.string.uuid(),
      //   keyboardKeys: faker.number.int(9),
      //   minutesActive: faker.number.int(9),
      //   mouseKeys: faker.number.int(9),
      //   mouseDistance: faker.number.int(9),
      //   fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
      //   toAt: moment.utc().toISOString(),
      //   projectId: projectB.id,
      // },
      {
        fromIndex: 3000,
        toIndex: 3001,
        note: faker.string.uuid(),
        keyboardKeys: faker.number.int(9),
        minutesActive: faker.number.int(9),
        mouseKeys: faker.number.int(9),
        mouseDistance: faker.number.int(9),
        fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
        toAt: moment.utc().toISOString(),
        projectId: projectC.id,
        // TODO: use image from the test assets
        screenshot: stream.toString('base64'),
        processes: [
          {
            name: faker.string.uuid(),
            description: faker.string.uuid(),
            timeMin: faker.number.int(9),
          },
        ],
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

    console.log('>>>>>', res.data)

    // const timeA = await runPromise(this.timeRepository.findOneByOrFail({
    //   where: {
    //     project: projectA,
    //   },
    // }));
    // const timeB = await runPromise(this.timeRepository.findOneByOrFail({
    //   where: {
    //     project: projectB,
    //   },
    // }));
    // const timeC = await runPromise(this.timeRepository.findOneByOrFail({
    //   where: {
    //     project: projectC,
    //   },
    // }));

    // const fromAtA = moment(timeA.fromAt).toISOString();
    // const fromAtB = moment(timeB.fromAt).toISOString();
    // const fromAtC = moment(timeC.fromAt).toISOString();

    // expect(fromAtA).to.be.equal(data[0].fromAt);
    // expect(fromAtB).to.be.equal(data[1].fromAt);
    // expect(fromAtC).to.be.equal(data[2].fromAt);

    // expect(timeA.screenshot).to.be.null;
    // expect(timeA.processes).to.be.null;
    // expect(timeB.screenshot).to.be.null;
    // expect(timeB.processes).to.be.null;
    // expect(timeC.screenshot).to.be.not.null;
    // expect(timeC.processes).to.be.deep.eq(data[2].processes);

    // expect(res.status).to.be.equal(200);
    // expect(res.data).to.be.deep.equal(data);
  }

  @test.skip
  async createRemote() {
    const file = join(
      __dirname,
      '../fixture/media/screenshot_20260127_184X00.webp',
    )
    const stream = fs.readFileSync(file)
    const projectId = '7ec869da-edb9-4ffa-ab96-f749454172ba'
    const screenshotData = stream.toString('base64')

    console.log('>>>>', screenshotData)

    // const data: TimeCreateDto[] = [
    const data = [
      {
        projectId,
        fromIndex: 3000,
        toIndex: 3001,
        note: 'Test 123',
        fromAt: '2026-01-27T15:40:00',
        toAt: '2026-01-27T15:40:00',
        keyboardKeys: 0,
        minutesActive: 0,
        mouseDistance: 0,
        mouseKeys: 0,
        procQueryId: 30,
        processes: [
          {
            name: 'Kded6',
            timeMin: 10,
          },
          {
            name: 'Plasmashell',
            timeMin: 10,
          },
          {
            name: 'Kdeconnectd',
            timeMin: 10,
          },
          {
            name: 'Pamac-Tray-Plasma',
            timeMin: 10,
          },
          {
            name: 'AmneziaVPN',
            timeMin: 10,
          },
          {
            name: 'Xdg-Desktop-Portal-Kde',
            timeMin: 10,
          },
          {
            name: 'Qtcreator',
            timeMin: 10,
          },
          {
            name: 'Dolphin',
            timeMin: 10,
          },
          {
            name: 'Assistant',
            timeMin: 10,
          },
          {
            name: 'Time-Tracker',
            timeMin: 10,
          },
        ],
        screenshot: screenshotData,
      },
    ]

    const client = this.apiClient()
    const res = await timeControllerCreateOrUpdateMany({
      client,
      headers: {
        Authorization:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBhZmRjZGYzLTQyZmYtNGEzNS05MWZhLWVkOGE1Mzc2YzFlYyIsImFkZHJlc3MiOiJVUUJLWFJrakpFc0toRnA3WFlvcF9XVkxXaXA2QXpIT1dYNUVXNWpkSTZ0QUpRWkoiLCJlbWFpbE9yUGhvbmUiOm51bGwsImlhdCI6MTc2OTQ0ODg4MywiZXhwIjoxNzcxMTc2ODgzfQ.BIc63S3ZqsUkV3nzl6kE5pbaChoZeJtnW2lufuuXx7Y',
      },
      body: data as unknown as ApiTimeCreateDto[],
      throwOnError: true,
    })

    console.log('>>>>>', res.data)
  }

  @test.skip
  async createLocal() {
    const file = join(
      __dirname,
      '../fixture/media/screenshot_20260127_184X00.webp',
    )
    const stream = fs.readFileSync(file)

    const user = await this.userFixture.createUser()
    const projectC = await this.projectFixture.createPersonal(
      user,
      0,
      true,
      true,
    )

    const data: TimeCreateDto[] = [
      {
        fromIndex: 3000,
        toIndex: 3001,
        note: faker.string.uuid(),
        keyboardKeys: faker.number.int(9),
        minutesActive: faker.number.int(9),
        mouseKeys: faker.number.int(9),
        mouseDistance: faker.number.int(9),
        fromAt: moment.utc().subtract(10, 'minutes').toISOString(),
        toAt: moment.utc().toISOString(),
        projectId: projectC.id,
        // TODO: use image from the test assets
        screenshot: stream.toString('base64'),
        processes: [
          {
            name: faker.string.uuid(),
            description: faker.string.uuid(),
            timeMin: faker.number.int(9),
          },
        ],
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

    console.log('>>>>>', res.data)
  }

  @test.skip
  async createPersonalInputValidationErrorA() {
    const user = await this.userFixture.createUser()
    const projectA = await this.projectFixture.createPersonal(user)
    const unix = moment().utc()
    const data: TimeCreateDto[] = [
      {
        fromIndex: 1000,
        toIndex: 1001,
        note: faker.string.uuid(),
        keyboardKeys: faker.number.int(9),
        minutesActive: faker.number.int(9),
        mouseKeys: faker.number.int(9),
        mouseDistance: faker.number.int(9),
        fromAt: moment(unix).subtract(10, 'minutes').toISOString(),
        toAt: moment(unix).toISOString(),
        projectId: projectA.id,
      },
      {
        fromIndex: 2000,
        toIndex: 2001,
        note: faker.string.uuid(),
        keyboardKeys: faker.number.int(9),
        minutesActive: faker.number.int(9),
        mouseKeys: faker.number.int(9),
        mouseDistance: faker.number.int(9),
        fromAt: moment(unix).subtract(10, 'minutes').toISOString(),
        toAt: moment(unix).toISOString(),
        projectId: '',
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
      data[0],
      {
        ...data[1],
        error: {
          name: 'QueryFailedError',
          message: 'invalid input syntax for type uuid: ""',
        },
      },
    ])
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
        minutesActive: 100000,
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
        minutesActive: 200000,
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
}
