import http from 'node:http'

import type { AddressInfo } from 'node:net'
import type { EIP1193Provider } from 'hardhat/types'

import type { RpcRequest } from '../../packages/identity/src'

/**
 * The in-process Hardhat chain, reachable the two ways a verifier reaches a
 * chain: as an `RpcRequest` called directly, and as a JSON-RPC endpoint over
 * HTTP on a loopback port the system picks. Nothing here touches port 8545,
 * so it runs beside a developer's own node.
 */
export function inProcessRpc(provider: EIP1193Provider): RpcRequest {
  return (method, params) => provider.request({ method, params })
}

export type RpcBridge = {
  url: string
  /** Every JSON-RPC method the endpoint was asked, in order. */
  methods: string[]
  close(): Promise<void>
}

/**
 * `answer` may replace the chain's reply to one request: return `undefined`
 * to let the chain answer. It is how a test pins the `finalized` tag to an
 * older block, which Hardhat itself always reports as the head.
 */
export async function startRpcBridge(
  provider: EIP1193Provider,
  answer: (method: string, params: unknown[]) => Promise<unknown> | unknown = () => undefined,
): Promise<RpcBridge> {
  const methods: string[] = []
  const reply = ({ id, method, params }: { id: number; method: string; params?: unknown[] }) => {
    methods.push(method)

    return Promise.resolve(answer(method, params ?? []))
      .then((replaced) => (replaced === undefined ? provider.request({ method, params }) : replaced))
      .then(
        (result) => ({ jsonrpc: '2.0', id, result }),
        (error: Error) => ({ jsonrpc: '2.0', id, error: { code: -32000, message: error.message } }),
      )
  }
  // A fork client may batch its reads; a batch is answered as one, in order.
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      const answered = Array.isArray(parsed) ? Promise.all(parsed.map(reply)) : reply(parsed)

      answered.then((body) => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(body))
      })
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    methods,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
