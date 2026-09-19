import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'

import { Invoice } from '@/entity/invoice'
import { InvoiceEscrow } from '@/service/invoice-escrow'

/**
 * The pure rules of an invoice's escrow binding: how cents become token base
 * units, how a salt is drawn, and how an allocation is compared.
 */
@suite()
export class InvoiceEscrowTest {
  @test()
  amountBaseUnits_isCentsTimesTenThousandAsIntegerText() {
    expect(InvoiceEscrow.amountBaseUnits(0)).to.equal('0')
    expect(InvoiceEscrow.amountBaseUnits(1)).to.equal('10000')
    expect(InvoiceEscrow.amountBaseUnits(12345)).to.equal('123450000')
    // (201 / 100) * 1e6 is 2009999.9999999998 in floating point.
    expect(InvoiceEscrow.amountBaseUnits(201)).to.equal('2010000')
    // Past 2^53 in base units, still exact.
    expect(InvoiceEscrow.amountBaseUnits(Number.MAX_SAFE_INTEGER)).to.equal(
      '90071992547409910000',
    )
  }

  @test()
  amountBaseUnits_refusesWhatIsNotWholeNonNegativeCents() {
    for (const value of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        () => InvoiceEscrow.amountBaseUnits(value),
        String(value),
      ).to.throw(TypeError)
    }
  }

  @test()
  drawSalt_isThirtyTwoFreshNonZeroBytes() {
    const salts = new Set(
      Array.from({ length: 64 }, () => InvoiceEscrow.drawSalt()),
    )

    expect(salts.size).to.equal(64)

    for (const salt of salts) {
      expect(salt).to.match(/^0x[\da-f]{64}$/)
      expect(salt).to.not.equal(`0x${'0'.repeat(64)}`)
    }
  }

  @test()
  binding_comparesAllocationsCaseInsensitively() {
    const invoice = new Invoice()
    const allocationId = `0x${'ab'.repeat(32)}`
    const escrow = `0x${'cd'.repeat(20)}`

    invoice.escrowChainId = 31337
    invoice.escrowAddress = escrow
    invoice.escrowAllocationId = allocationId

    expect(
      InvoiceEscrow.isBoundTo(invoice, {
        chainId: 31337,
        escrow: escrow.toUpperCase().replace('0X', '0x'),
        allocationId: allocationId.toUpperCase().replace('0X', '0x'),
      }),
    ).to.be.true
    expect(
      InvoiceEscrow.isBoundTo(invoice, { chainId: 1, escrow, allocationId }),
    ).to.be.false
    expect(
      InvoiceEscrow.isBoundTo(invoice, {
        chainId: 31337,
        escrow,
        allocationId: `0x${'ac'.repeat(32)}`,
      }),
    ).to.be.false
  }
}
