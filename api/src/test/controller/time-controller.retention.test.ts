import { expect } from 'chai'
import moment from 'moment'
import { suite, test } from '@testdeck/mocha'

import { timeControllerRetentionNotice } from '@app/api-client'

import { BaseControllerTest } from '@/test/controller/base-controller.test'
import { EProjectState } from '@/model/project'
import { RetentionJob } from '@/service/retention-job'
import { TimeManager } from '@/service/time-manager'
import { User } from '@/entity/user'

/** GET /api/time/retention-notice, the dashboard's advance notice (DEC-05). */
@suite()
export class TimeControllerRetentionTest extends BaseControllerTest {
  private async notice(user: User) {
    const res = await timeControllerRetentionNotice({
      client: this.apiClient(),
      headers: {
        Authorization: this.authenticator.getTokens(user).accessToken,
      },
      throwOnError: true,
    })

    return res.data
  }

  @test()
  async retentionNotice_listsAFreeOwnersEntriesDueWithinTheLeadTime() {
    const owner = await this.userFixture.createUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const from = moment
      .utc()
      .subtract(TimeManager.freeTimeLogRetentionDays + 5, 'days')
    await this.timeFixture.create(
      project,
      from.toDate(),
      from.clone().add(10, 'minutes').toDate(),
    )

    const notice = await this.notice(owner)

    expect(notice.count).to.eq(1)
    expect(notice.rotatesAt).to.be.a('string')
    expect(notice.windowDays).to.eq(TimeManager.freeTimeLogRetentionDays)
    expect(notice.noticeDays).to.eq(RetentionJob.NOTICE_DAYS)
  }

  @test()
  async retentionNotice_isEmptyForAPremiumOwner() {
    const owner = await this.userFixture.createPremiumUser()
    const project = await this.projectFixture.create(
      owner,
      EProjectState.ACTIVE,
    )
    const from = moment.utc().subtract(40, 'days')
    await this.timeFixture.create(
      project,
      from.toDate(),
      from.clone().add(10, 'minutes').toDate(),
    )

    const notice = await this.notice(owner)

    expect(notice.count).to.eq(0)
    expect(notice.rotatesAt).to.eq(null)
  }
}
