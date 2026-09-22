/**
 * The one way this package reaches a network: JSON-RPC 2.0 over HTTP POST to
 * the endpoint the caller names. The verifier and the receipt builder take a
 * `RpcRequest` and nothing else, so what they ask, and of whom, is always the
 * caller's visible choice: hand them this transport with an endpoint you
 * trust, or any function of the same shape (a wallet's EIP-1193 `request`, a
 * test chain running in the same program).
 *
 * Nothing here knows a Work Address host. The transport posts to `url` and
 * nowhere else, follows no redirect to another origin's API, and sends no
 * cookie or credential.
 */
export type RpcRequest = (method: string, params: unknown[]) => Promise<unknown>

/** The shape of the Fetch API this transport needs; the runtime's own by default. */
export type FetchLike = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; credentials: 'omit'; redirect: 'error' },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/**
 * The endpoint could not answer: it is down, it refused, it answered
 * something that is not JSON-RPC, or it returned a JSON-RPC error. It says
 * nothing about the document being checked, and a verifier must never turn
 * it into a failed proof.
 */
export class RpcUnavailableError extends Error {
  readonly method: string
  /**
   * `refused`: the endpoint answered, with a JSON-RPC error. `unreachable`:
   * no usable answer came back at all. `foreign`: a caller-supplied
   * `RpcRequest` threw, and only it knows which of the two that was.
   */
  readonly kind: 'refused' | 'unreachable' | 'foreign'

  constructor(method: string, message: string, kind: 'refused' | 'unreachable' | 'foreign' = 'unreachable') {
    super(message)
    this.name = 'RpcUnavailableError'
    this.method = method
    this.kind = kind
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A JSON-RPC transport over the Fetch API, for browsers and Node 18 or
 * later. Every failure is an `RpcUnavailableError`.
 */
export function jsonRpcTransport(url: string, options: { fetch?: FetchLike } = {}): RpcRequest {
  let nextId = 1

  return async (method, params) => {
    const send = options.fetch ?? (globalThis as unknown as { fetch?: FetchLike }).fetch

    if (typeof send !== 'function') {
      throw new RpcUnavailableError(method, 'This runtime has no fetch; pass one, or another RpcRequest')
    }

    let answer: unknown

    try {
      const response = await send(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
        credentials: 'omit',
        redirect: 'error',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      answer = await response.json()
    } catch (error) {
      throw new RpcUnavailableError(method, `${method} failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (!isRecord(answer) || (!('result' in answer) && !('error' in answer))) {
      throw new RpcUnavailableError(method, `${method} was not answered with JSON-RPC`)
    }
    if (answer.error !== undefined && answer.error !== null) {
      const message = isRecord(answer.error) && typeof answer.error.message === 'string' ? answer.error.message : 'error'

      throw new RpcUnavailableError(method, `${method} was refused: ${message}`, 'refused')
    }

    return answer.result
  }
}

const QUANTITY = /^0x(0|[1-9a-f][0-9a-f]*)$/

/** A JSON-RPC quantity as a safe integer, or an `RpcUnavailableError` naming what came back instead. */
export function quantity(method: string, value: unknown): number {
  if (typeof value !== 'string' || !QUANTITY.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new RpcUnavailableError(method, `${method} answered ${JSON.stringify(value)}, not a quantity`)
  }

  return Number(value)
}

export function toQuantity(value: number): string {
  return `0x${value.toString(16)}`
}

/** Runs one request, and wraps whatever a foreign `RpcRequest` throws. */
export async function ask(rpc: RpcRequest, method: string, params: unknown[]): Promise<unknown> {
  try {
    return await rpc(method, params)
  } catch (error) {
    if (error instanceof RpcUnavailableError) throw error

    throw new RpcUnavailableError(method, `${method} failed: ${error instanceof Error ? error.message : String(error)}`, 'foreign')
  }
}

export async function chainIdOf(rpc: RpcRequest): Promise<number> {
  return quantity('eth_chainId', await ask(rpc, 'eth_chainId', []))
}

export type BlockRef = { number: number; hash: string; timestamp: number }

/** The block a tag or number names, or null where the node has none (no `finalized` before the merge). */
export async function blockOf(rpc: RpcRequest, tag: 'latest' | 'finalized' | number): Promise<BlockRef | null> {
  const method = 'eth_getBlockByNumber'
  let block: unknown

  try {
    block = await ask(rpc, method, [typeof tag === 'number' ? toQuantity(tag) : tag, false])
  } catch (error) {
    // A node that does not know the tag refuses it; that is "no finalized block", not an outage.
    if (tag === 'finalized' && error instanceof RpcUnavailableError && error.kind !== 'unreachable') return null

    throw error
  }

  if (block === null || block === undefined) return null

  if (!isRecord(block) || typeof block.hash !== 'string') {
    throw new RpcUnavailableError(method, `${method} answered something that is not a block`)
  }

  return { number: quantity(method, block.number), hash: block.hash, timestamp: quantity(method, block.timestamp) }
}

/** `eth_call` at an exact block number, so two reads of one verification see one state. */
export async function callAt(rpc: RpcRequest, to: string, data: string, block: number): Promise<string> {
  const result = await ask(rpc, 'eth_call', [{ to, data }, toQuantity(block)])

  if (typeof result !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(result)) {
    throw new RpcUnavailableError('eth_call', 'eth_call answered something that is not bytes')
  }

  return result
}

export type RpcLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: number
  transactionHash: string
  logIndex: number
}

/** Most blocks one `eth_getLogs` request covers here; public endpoints cap the range. */
export const LOG_BLOCK_RANGE = 2000

type LogFilter = { address: string; topics: (string | string[] | null)[]; fromBlock: number; toBlock: number }

/**
 * Logs of one address between two blocks, inclusive, asked for in ranges a
 * public endpoint accepts. A log the node marks `removed` was reorganised
 * away and is left out.
 */
export async function logsOf(rpc: RpcRequest, filter: LogFilter, range: number = LOG_BLOCK_RANGE): Promise<RpcLog[]> {
  const logs: RpcLog[] = []

  for (let from = filter.fromBlock; from <= filter.toBlock; from += range) {
    logs.push(...(await logPage(rpc, filter, from, Math.min(from + range - 1, filter.toBlock))))
  }

  return sortedLogs(logs)
}

/**
 * Logs matching a filter selective enough to be asked for in one request -
 * an event and an indexed id, which match a handful of logs however many
 * blocks they span - over the whole range at once. Paged in ranges only
 * when the endpoint refuses that one request (a JSON-RPC error: a range or
 * result cap); an endpoint that did not answer at all is not asked again.
 * One request per id instead of one per `range` blocks since the deployment:
 * a year of mainnet is some 1,300 pages. A caller-supplied `RpcRequest` that
 * threw may have been refused too (a wallet's provider says so its own
 * way), so it is paged as well; the first page tells whether it answers.
 */
export async function selectiveLogsOf(rpc: RpcRequest, filter: LogFilter, range: number = LOG_BLOCK_RANGE): Promise<RpcLog[]> {
  if (filter.toBlock - filter.fromBlock < range) return logsOf(rpc, filter, range)

  try {
    return sortedLogs(await logPage(rpc, filter, filter.fromBlock, filter.toBlock))
  } catch (error) {
    if (error instanceof RpcUnavailableError && error.kind !== 'unreachable') return logsOf(rpc, filter, range)

    throw error
  }
}

async function logPage(rpc: RpcRequest, filter: LogFilter, from: number, to: number): Promise<RpcLog[]> {
  const method = 'eth_getLogs'
  const page = await ask(rpc, method, [{ address: filter.address, topics: filter.topics, fromBlock: toQuantity(from), toBlock: toQuantity(to) }])

  if (!Array.isArray(page)) throw new RpcUnavailableError(method, `${method} answered something that is not a list of logs`)

  const logs: RpcLog[] = []

  for (const log of page as unknown[]) {
    if (
      !isRecord(log) ||
      typeof log.address !== 'string' ||
      typeof log.data !== 'string' ||
      typeof log.transactionHash !== 'string' ||
      !Array.isArray(log.topics) ||
      !log.topics.every((topic) => typeof topic === 'string')
    ) {
      throw new RpcUnavailableError(method, `${method} answered something that is not a log`)
    }

    if (log.removed === true) continue

    logs.push({
      address: log.address,
      topics: log.topics as string[],
      data: log.data,
      blockNumber: quantity(method, log.blockNumber),
      transactionHash: log.transactionHash.toLowerCase(),
      logIndex: quantity(method, log.logIndex),
    })
  }

  return logs
}

function sortedLogs(logs: RpcLog[]): RpcLog[] {
  return logs.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
}
