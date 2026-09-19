import { suite, test } from '@testdeck/mocha'
import { expect } from 'chai'
import * as web3 from 'web3'

import { Invoice } from '@/entity/invoice'
import { InvoiceEscrow } from '@/service/invoice-escrow'

/** `value` as a big-endian unsigned integer of `bytes` bytes. */
function uint(value: number, bytes: number): Buffer {
  return Buffer.from(
    BigInt(value)
      .toString(16)
      .padStart(bytes * 2, '0'),
    'hex',
  )
}

function hex(value: string): Buffer {
  return Buffer.from(value.slice(2), 'hex')
}

/**
 * The pure rules of an invoice's escrow binding: how cents become token base
 * units, how a salt is drawn, how an allocation is compared, and which
 * allocation funds a marketplace contract's work period.
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

  /**
   * The ids web/api's EscrowManager signs into escrow terms, for one
   * contract and period: computed there, with its own call -
   * `ethers.solidityPackedKeccak256(['string', 'string', 'uint64',
   * 'uint64'], ['work-address:contract-period', contractId, workStart,
   * workEnd])`, then `(['uint256', 'address', 'bytes32'], [chainId, escrow,
   * obligationId])` - and pinned here. The contract id is the one the
   * commitment vectors name, over a week from 2026-09-01T09:00:00Z.
   */
  @test()
  contractPeriodAllocationId_isTheMarketplacesDerivation() {
    const contractId = '6b0f5c52-3f0e-4d4e-9a53-2f7f1f0a9c11'
    const request = {
      chainId: 31337,
      escrow: '0x8bbc3514477d75ec797bbe4e19d7961660bb849c',
      allocationId: '',
      workStart: 1788253200,
      workEnd: 1788858000,
    }
    const allocationId =
      '0x6616bc928615d8644d68c8802a2b8603347787f167d51d4c5ada2b9f0ead4ec7'

    expect(
      InvoiceEscrow.obligationId(
        contractId,
        request.workStart,
        request.workEnd,
      ),
    ).to.equal(
      '0x0f3024456b825ffbc3b39e289d495748c7def0f4c2a9cb1ee867c17a26211c39',
    )
    expect(
      InvoiceEscrow.contractPeriodAllocationId(contractId, request),
    ).to.equal(allocationId)
    // The escrow in checksum casing is the same escrow.
    expect(
      InvoiceEscrow.contractPeriodAllocationId(contractId, {
        ...request,
        escrow: '0x8BBC3514477D75EC797BBE4E19D7961660BB849C',
      }),
    ).to.equal(allocationId)
  }

  /**
   * Off the pinned values, the ids are the packed encodings Solidity's
   * abi.encodePacked gives - each time a full 8 bytes, whatever its size -
   * so every part of the contract, period, chain and escrow moves them.
   */
  @test()
  contractPeriodAllocationId_packsEveryPartLikeSolidity() {
    const contractId = 'd2a7c1e4-58b3-4f0a-9e6d-3b1c7a2f4e90'
    const escrow = `0x${'5a'.repeat(20)}`
    const periods = [
      { workStart: 0, workEnd: 1 },
      { workStart: 1788253200, workEnd: 1788858000 },
      // Past 2^32 seconds, where a 4-byte encoding would have to wrap.
      { workStart: 2 ** 32 + 5, workEnd: 2 ** 40 },
    ]
    const seen = new Set<string>()

    for (const chainId of [1, 31337]) {
      for (const period of periods) {
        const obligationId = web3.utils.keccak256(
          Buffer.concat([
            Buffer.from('work-address:contract-period', 'utf8'),
            Buffer.from(contractId, 'utf8'),
            uint(period.workStart, 8),
            uint(period.workEnd, 8),
          ]),
        )
        const allocationId = web3.utils.keccak256(
          Buffer.concat([uint(chainId, 32), hex(escrow), hex(obligationId)]),
        )

        expect(
          InvoiceEscrow.obligationId(
            contractId,
            period.workStart,
            period.workEnd,
          ),
        ).to.equal(obligationId)
        expect(
          InvoiceEscrow.contractPeriodAllocationId(contractId, {
            chainId,
            escrow,
            allocationId: '',
            ...period,
          }),
        ).to.equal(allocationId)

        seen.add(allocationId)
      }
    }

    expect(seen.size).to.equal(6)
  }

  @test()
  obligationId_refusesTimesThatAreNotUint64Seconds() {
    for (const [workStart, workEnd] of [
      [-1, 10],
      [0, 1.5],
      [0, Number.MAX_SAFE_INTEGER + 1],
    ]) {
      expect(
        () => InvoiceEscrow.obligationId('contract', workStart, workEnd),
        `${workStart}..${workEnd}`,
      ).to.throw(TypeError)
    }
  }

  /** An invoice's period is inside a work period with both ends included. */
  @test()
  withinPeriod_includesBothEndsAndNothingOutside() {
    const invoice = new Invoice()

    invoice.fromAt = new Date('2026-09-01T09:00:00.000Z')
    invoice.toAt = new Date('2026-09-01T10:30:00.000Z')

    const fromAt = invoice.fromAt.getTime() / 1000
    const toAt = invoice.toAt.getTime() / 1000

    expect(
      InvoiceEscrow.withinPeriod(invoice, { workStart: fromAt, workEnd: toAt }),
    ).to.be.true
    expect(
      InvoiceEscrow.withinPeriod(invoice, {
        workStart: fromAt + 1,
        workEnd: toAt,
      }),
    ).to.be.false
    expect(
      InvoiceEscrow.withinPeriod(invoice, {
        workStart: fromAt,
        workEnd: toAt - 1,
      }),
    ).to.be.false
  }
}
