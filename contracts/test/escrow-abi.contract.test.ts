import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Interface, id } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'

import type { ErrorFragment, EventFragment, FunctionFragment } from 'ethers'

/**
 * MarketplaceEscrow's ABI, written out once so that every off-chain reader can
 * be checked against it. Nothing imports the compiled artifact: the website
 * hand-writes human-readable fragments for the calls it makes, the API does
 * the same for the events it indexes and the views its keeper reads, and the
 * end-to-end suites carry their own copies again. A struct field added in the
 * middle of `readAllocation`, or an event argument that moves, decodes into
 * the wrong names in all of them without any of them failing to compile.
 *
 * `fixtures/escrow-abi.contract.json` is that one written-out ABI, and a
 * byte-identical copy lives in web/api/src/test/fixture, where the marketplace
 * checks its own copies against it. This test holds the fixture to the
 * contract; the one there holds the readers to the fixture.
 *
 * Regenerate after an intended change (from the repository root):
 *
 *   npx hardhat compile && node -e "…" > test/fixtures/escrow-abi.contract.json
 *
 * — but read the diff. Every line of it is a change some other repository has
 * to make too.
 */
describe('escrow ABI contract', () => {
  it('is the ABI MarketplaceEscrow compiles to, signature for signature', async () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/escrow-abi.contract.json'),
        'utf8',
      ),
    ) as { functions: string[]; events: string[]; errors: string[] }
    const compiled = (await ethers.getContractFactory('MarketplaceEscrow'))
      .interface

    const formatted = (type: string) =>
      compiled.fragments
        .filter((fragment) => fragment.type === type)
        .map((fragment) => fragment.format('full'))
        .sort()

    expect(formatted('function')).to.deep.eq(fixture.functions)
    expect(formatted('event')).to.deep.eq(fixture.events)
    expect(formatted('error')).to.deep.eq(fixture.errors)
  })

  it('parses back to the same interface, so a consumer can use it as the ABI', async () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/escrow-abi.contract.json'),
        'utf8',
      ),
    ) as { functions: string[]; events: string[]; errors: string[] }
    const rebuilt = new Interface([
      ...fixture.functions,
      ...fixture.events,
      ...fixture.errors,
    ])
    const compiled = (await ethers.getContractFactory('MarketplaceEscrow'))
      .interface

    // Selectors, not names: this is what a wallet actually sends and what a
    // log actually matches.
    const selectors = (iface: Interface) =>
      iface.fragments
        .map((fragment): string | null => {
          if (fragment.type === 'event') {
            return id((fragment as EventFragment).format('sighash'))
          }

          if (fragment.type === 'function' || fragment.type === 'error') {
            return id(
              (fragment as FunctionFragment | ErrorFragment).format('sighash'),
            ).slice(0, 10)
          }

          return null
        })
        .filter((selector): selector is string => selector !== null)
        .sort()

    expect(selectors(rebuilt)).to.deep.eq(selectors(compiled))
  })
})
