import hre from 'hardhat'

import {
  LOCAL_TOKENS,
  deployLocal,
  escrowEnvLines,
  localAccountKey,
  manifestPath,
  writeManifest,
} from './local-chain'

import type { LocalToken } from './local-chain'

/**
 * Deploys the local test USDT, the escrow and the identity registry to the
 * local Hardhat chain — in process (`deploy:local`) or a running
 * `hardhat node` (`deploy:localhost`), which also gets a manifest in
 * deployments/. Refuses every other chain, mainnet by name: a public
 * deployment waits for the security review (SPEC §14–15).
 *
 * LOCAL_TOKEN=MockUSDT swaps the Tether-like token for a plain ERC-20.
 */
async function main() {
  const token = (process.env.LOCAL_TOKEN ?? 'TetherLikeUSDT') as LocalToken

  if (!LOCAL_TOKENS.includes(token)) {
    throw new Error(`LOCAL_TOKEN must be ${LOCAL_TOKENS.join(' or ')}, not ${token}`)
  }

  const manifest = await deployLocal(hre, { token })

  console.log(JSON.stringify(manifest, null, 2))

  if (hre.network.name === 'hardhat') {
    console.log('\nIn-process chain: nothing was persisted. Use deploy:localhost against `npm run node`.')
    return
  }

  const file = manifestPath(hre.network.name)

  writeManifest(file, manifest)
  console.log(`\nWrote ${file}`)
  console.log('\n# web/api/.env — local Hardhat node only; the key is a public Hardhat test key')
  console.log(escrowEnvLines(manifest, localAccountKey(hre, manifest.originSigner)).join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
