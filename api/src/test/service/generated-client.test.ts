import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'

const REPO_ROOT = path.join(__dirname, '../../../..')

/**
 * The committed browser clients and the spec they come from, as generated
 * files: what ships is what is checked in, so a route left out of the live
 * spec is only really gone once both clients are regenerated without it.
 */
@suite()
export class GeneratedClientTest {
  @test()
  generated_haveNoServiceToServiceRoutes() {
    const files = [
      'packages/api-client/openapi.json',
      'packages/api-client/src/features/shared/api/generated/sdk.gen.ts',
      'packages/api-client/src/features/shared/api/generated/types.gen.ts',
      'web/src/shared/api/generated/sdk.gen.ts',
      'web/src/shared/api/generated/types.gen.ts',
    ]

    for (const file of files) {
      const source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')

      expect(source, file).to.not.contain('/api/internal/')
      expect(source, file).to.not.match(/EntitlementPush|MarketplaceHire/)
    }
  }
}
