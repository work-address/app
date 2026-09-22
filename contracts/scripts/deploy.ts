import hre from 'hardhat'

import { runDeploy } from './deploy-command'

/**
 * `hardhat run scripts/deploy.ts`: the local deploy, in process
 * (`deploy:local`) or to a running `hardhat node` (`deploy:localhost`, which
 * also writes deployments/localhost.json and prints web/api's escrow lines).
 *
 * A script run through `hardhat run` takes no flags, so it can never carry
 * the confirmation a public chain needs: pointed at one, it stops before
 * sending anything. `pnpm run deploy:sepolia` is the only way to a testnet,
 * and mainnet has none. LOCAL_TOKEN=MockUSDT swaps the Tether-like token for
 * a plain ERC-20.
 */
runDeploy(hre).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
