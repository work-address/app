import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { expect } from 'chai'
import { suite, test, timeout } from '@testdeck/mocha'

import { SentryRequestPolicy } from '@/service/sentry-request-policy'

@suite()
export class SentryRequestPolicyTest {
  @test()
  omitsAuthenticationEndpointsWithQueriesAndAbsoluteUrls() {
    for (const url of [
      '/api/auth',
      '/api/auth/google',
      '/api/auth/refresh?source=browser',
      'https://app.example/api/auth/eth',
      '/API/AUTH/TON',
      '/api/auth/timeTracker/nonce',
    ]) {
      expect(SentryRequestPolicy.omitAuthBody(url), url).to.equal(true)
    }

    for (const url of ['/api/user', '/api/author', '/api/authentication']) {
      expect(SentryRequestPolicy.omitAuthBody(url), url).to.equal(false)
    }
  }

  @test()
  @timeout(15000)
  excludesCredentialsFromActualSentryHttpCapture() {
    // SDK instrumentation is global; exercise it in a fresh process so other
    // controller suites keep their existing HTTP/Express configuration.
    const output = execFileSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        path.join(__dirname, '../fixture/sentry-request-fixture.ts'),
      ],
      { cwd: path.resolve(__dirname, '../../..'), timeout: 10000 },
    )

    expect(output.toString().trim()).to.equal('Sentry request capture passed')
  }
}
