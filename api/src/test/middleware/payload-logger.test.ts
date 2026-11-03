import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { PayloadLogger } from '@/middleware/payload-logger'

@suite()
export class PayloadLoggerTest {
  @test()
  redactsGoogleCredentialsWithoutChangingRequestBody() {
    const body = { credential: 'google-id-token', name: 'Example' }

    expect(PayloadLogger.redactCredentials(body)).to.deep.equal({
      credential: '[REDACTED]',
      name: 'Example',
    })
    expect(body.credential).to.equal('google-id-token')
  }

  @test()
  redactsNestedCredentialsAndTokenAliases() {
    expect(
      PayloadLogger.redactCredentials({
        items: [{ credential: 'secret', 'refresh-token': 'secret' }],
        accessToken: 'secret',
        signature: 'secret',
        count: 2,
        empty: null,
      }),
    ).to.deep.equal({
      items: [{ credential: '[REDACTED]', 'refresh-token': '[REDACTED]' }],
      accessToken: '[REDACTED]',
      signature: '[REDACTED]',
      count: 2,
      empty: null,
    })
  }
}
