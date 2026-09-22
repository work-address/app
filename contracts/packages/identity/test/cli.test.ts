import { expect } from 'chai'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { EXIT, receiptsExit, run } from '../cli/verify-cli'

import type { AddressInfo } from 'node:net'

/**
 * The command's exit status is what a script acts on, so it has to say what
 * happened: a run that built no receipt is not a pass, and an endpoint that
 * could not answer is reported as that - with the line saying no block was
 * checked - never as a command line that could not be read. The chain here
 * is a scripted JSON-RPC server on a loopback port, so the command runs its
 * real transport; contracts/test/settlement-receipts runs it against the
 * deployed escrow.
 */
const ESCROW = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
const PAYEE = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const MANIFEST = { chainId: 31337, deployBlock: 3, escrow: { address: ESCROW }, token: null }

type Node = { url: string; close: () => Promise<void> }

/** A node at head 60 whose escrow was never funded; `finalized: null` names no finalized block. */
async function scriptedNode(finalized: number | null): Promise<Node> {
  const block = (number: number) => ({ number: `0x${number.toString(16)}`, hash: `0x${number.toString(16).padStart(64, '0')}`, timestamp: '0x6ab0a000' })
  const server = http.createServer((request, response) => {
    let body = ''

    request.on('data', (chunk) => (body += chunk))
    request.on('end', () => {
      const { id, method, params } = JSON.parse(body) as { id: number; method: string; params: unknown[] }
      const answer = (result: unknown) => response.end(JSON.stringify({ jsonrpc: '2.0', id, result }))

      if (method === 'eth_chainId') return answer('0x7a69')
      if (method === 'eth_getBlockByNumber') return answer(params[0] === 'finalized' ? (finalized === null ? null : block(finalized)) : block(60))
      if (method === 'eth_getLogs') return answer([])

      response.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `unscripted ${method}` } }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

async function receiptsRun(rpc: string): Promise<{ status: number; out: string; err: string }> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-cli-'))
  const manifest = path.join(directory, 'manifest.json')
  const out: string[] = []
  const err: string[] = []

  fs.writeFileSync(manifest, JSON.stringify(MANIFEST))

  try {
    const status = await run(['receipts', '--subject', PAYEE, '--manifest', manifest, '--rpc', rpc], {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    })

    return { status, out: out.join('\n'), err: err.join('\n') }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

describe('verify receipts, the command', () => {
  it('exits 1 when it built no receipt: nothing paid to the subject is not a verification', async () => {
    const node = await scriptedNode(50)

    try {
      const result = await receiptsRun(node.url)

      expect(result.status, result.err).to.eq(EXIT.refuted)
      expect(result.out).to.contain('Result: Built')
      expect(result.out).to.contain('0 of 0 allocations were released')
      expect(result.out).to.contain('Block checked: 50 (finalized)')
    } finally {
      await node.close()
    }
  })

  it('reports a chain with no finalized block as undetermined, with the block line', async () => {
    const node = await scriptedNode(null)

    try {
      const result = await receiptsRun(node.url)

      expect(result.status, result.err).to.eq(EXIT.undetermined)
      expect(result.out).to.contain('Result: NotFinal')
      expect(result.out).to.contain('Block checked: none')
      expect(result.err).to.not.contain('Usage:')
    } finally {
      await node.close()
    }
  })

  it('reports an endpoint that does not answer as an RPC failure, not a usage error', async () => {
    // Port 9 is discard: nothing listens there, so the connection is refused.
    const result = await receiptsRun('http://127.0.0.1:9')

    expect(result.status).to.eq(EXIT.undetermined)
    expect(result.out).to.contain('Result: RpcUnavailable')
    expect(result.out).to.contain('This says nothing about the allocations')
    expect(result.out).to.contain('Block checked: none')
    expect(result.err).to.not.contain('Usage:')
  })

  it('passes only with a receipt, and waits on a release that is not final yet', () => {
    const allocation = (outcome: string) => ({ allocationId: `0x${'ab'.repeat(32)}`, contract: ESCROW, outcome, detail: '', refunded: null }) as never

    expect(receiptsExit({ result: 'Built', receipts: [{} as never], allocations: [allocation('Released')] })).to.eq(EXIT.verified)
    expect(receiptsExit({ result: 'Built', receipts: [], allocations: [allocation('CancelledBeforeWork')] })).to.eq(EXIT.refuted)
    expect(receiptsExit({ result: 'Built', receipts: [], allocations: [allocation('NotFinal')] })).to.eq(EXIT.undetermined)
    expect(receiptsExit({ result: 'RpcUnavailable', receipts: [], allocations: [] })).to.eq(EXIT.undetermined)
    expect(receiptsExit({ result: 'RegistryNotInManifest', receipts: [], allocations: [] })).to.eq(EXIT.refuted)
  })
})
