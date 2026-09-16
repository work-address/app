import { expect } from 'chai'
import { ethers } from 'hardhat'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The marketplace API signs escrow terms off-chain; this contract verifies
 * them on-chain. Both sides read `fixtures/escrow-terms.contract.json` (a
 * byte-identical copy lives in web/api/src/test/fixture), so a change to the
 * type string, field order or domain on either side fails a test here or
 * there before it reaches a wallet.
 */
describe('escrow terms digest contract', () => {
  it('matches the digest the marketplace API computes', async () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures/escrow-terms.contract.json'),
        'utf8',
      ),
    )
    const [originSigner, feeRecipient] = await ethers.getSigners()
    const token = await (await ethers.getContractFactory('MockUSDT')).deploy()
    const Escrow = await ethers.getContractFactory('MarketplaceEscrow')
    const escrow: any = await Escrow.deploy(
      await token.getAddress(),
      feeRecipient.address,
      originSigner.address,
    )
    const domain = {
      ...fixture.domain,
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await escrow.getAddress(),
    }
    const expected = ethers.TypedDataEncoder.hash(
      domain,
      fixture.types,
      fixture.terms,
    )

    expect(await escrow.TERMS_TYPEHASH()).to.eq(fixture.typeHash)
    expect(await escrow.termsDigest(fixture.terms)).to.eq(expected)
    expect(
      ethers.TypedDataEncoder.hash(
        { ...fixture.domain, chainId: fixture.chainId, verifyingContract: fixture.verifyingContract },
        fixture.types,
        fixture.terms,
      ),
    ).to.eq(fixture.digest)
  })
})
