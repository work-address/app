import { ethers, network } from 'hardhat'

/**
 * Deploys a mock USDT and the escrow to the in-process Hardhat network, for
 * local development of the funding screens. Refuses any other network: a
 * public deployment waits for the chain/asset decision and the security
 * review (SPEC §14–15).
 */
async function main() {
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    throw new Error(`Refusing to deploy to ${network.name}: local networks only`)
  }

  const [deployer, feeRecipient, originSigner] = await ethers.getSigners()
  const token = await (await ethers.getContractFactory('MockUSDT')).deploy()
  const escrow = await (
    await ethers.getContractFactory('MarketplaceEscrow')
  ).deploy(await token.getAddress(), feeRecipient.address, originSigner.address)

  console.log(
    JSON.stringify(
      {
        network: network.name,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        deployer: deployer.address,
        token: await token.getAddress(),
        escrow: await escrow.getAddress(),
        feeRecipient: feeRecipient.address,
        originSigner: originSigner.address,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
