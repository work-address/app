import { expect } from 'chai'
import axios from 'axios'
import { suite, test } from '@testdeck/mocha'

import { BaseControllerTest } from '@/test/controller/base-controller.test'

@suite()
export class UserControllerSearchTest extends BaseControllerTest {
  // POST /user/search handed every account's email and phone to any
  // signed-in user. It had no callers, so it was removed; this keeps it gone.
  @test()
  async search_isNotServedEvenToASignedInUser() {
    const user = await this.userFixture.createUser()
    let status: number | undefined

    try {
      await axios.post(
        `${this.url}/api/user/search`,
        { filter: {}, sort: { createdAt: 'DESC' }, page: 0 },
        {
          headers: {
            Authorization: this.authenticator.getTokens(user).accessToken,
          },
        },
      )
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) throw error
      status = error.response?.status
    }

    expect(status).to.equal(404)
  }
}
