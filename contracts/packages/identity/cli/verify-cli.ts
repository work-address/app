import fs from 'node:fs'

import { ManifestError, failuresOf, isWithdrawn, jsonRpcTransport, qualificationsOf, readManifest, verifyOrigin, verifyPresentation } from '../src'

import type { OriginCertificate, VerificationReport } from '../src'

/**
 * The independent verifier as a command. It reads files the holder handed
 * over, asks the RPC endpoint named on the command line, and nothing else:
 * no Work Address host is contacted, and none could change the answer.
 *
 * Exit status, so a script can tell the three apart:
 *
 *   0  verified: an identity that is Current or SelfSignedOnly, a certificate
 *      whose every version opens
 *   1  refuted, or not recognised: the evidence does not support the claim
 *   2  the command line or a file could not be read
 *   3  undetermined: the endpoint did not answer, the chain has not finalized
 *      its answer, or a certificate declares its own terms unproven. Not a
 *      failed proof, and not a pass
 */
export const EXIT = { verified: 0, refuted: 1, usage: 2, undetermined: 3 } as const

export type CliIo = { out: (line: string) => void; err: (line: string) => void }

export const USAGE = `Usage:
  verify identity <presentation.json> --manifest <deployment.json> --rpc <url>
                  [--subject <address>] [--finality finalized|latest] [--json]
  verify origin <certificate.json> [--signer <address>] [--json]

  --manifest   deployment manifest (deployments/<network>.json): the registries and
               escrows you accept. A copy of either contract proves nothing.
  --rpc        a JSON-RPC endpoint you trust. The only host this command contacts.
  --subject    refuse a document about any other account.
  --finality   "finalized" (default) accepts only the node's finalized block;
               "latest" reads the head, for a development chain.
  --signer     the origin signer the deployment publishes; a certificate signed
               by anyone else is refused.

Exit status: 0 verified, 1 refuted or not recognised, 2 usage, 3 undetermined.`

class UsageError extends Error {}

type Arguments = { positional: string[]; options: Map<string, string>; flags: Set<string> }

const VALUE_OPTIONS = new Set(['manifest', 'rpc', 'subject', 'finality', 'signer'])
const FLAGS = new Set(['json', 'help'])

function parse(argv: readonly string[]): Arguments {
  const parsed: Arguments = { positional: [], options: new Map(), flags: new Set() }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (!argument.startsWith('--')) {
      parsed.positional.push(argument)
      continue
    }

    const [name, inline] = argument.slice(2).split(/=(.*)/s, 2)

    if (FLAGS.has(name)) {
      parsed.flags.add(name)
    } else if (VALUE_OPTIONS.has(name)) {
      const value = inline ?? argv[(index += 1)]

      if (value === undefined) throw new UsageError(`--${name} needs a value`)

      parsed.options.set(name, value)
    } else {
      throw new UsageError(`Unknown option --${name}`)
    }
  }

  return parsed
}

function readJson(file: string, what: string): unknown {
  let text: string

  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    throw new UsageError(`Cannot read the ${what} at ${file}`)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new UsageError(`The ${what} at ${file} is not JSON`)
  }
}

function required(parsed: Arguments, name: string): string {
  const value = parsed.options.get(name)

  if (value === undefined) throw new UsageError(`--${name} is required`)

  return value
}

/** The block line every identity run prints, whatever the result. */
export function blockLine(report: Pick<VerificationReport, 'checkedAtBlock' | 'finalized'>): string {
  if (report.checkedAtBlock === null) return 'Block checked: none (the chain was not read)'

  return `Block checked: ${report.checkedAtBlock} (${report.finalized ? 'finalized' : 'not finalized'})`
}

export function identityExit(report: VerificationReport): number {
  if (report.accepted) return EXIT.verified

  return report.result === 'RpcUnavailable' || report.result === 'NotFinal' ? EXIT.undetermined : EXIT.refuted
}

async function identity(parsed: Arguments, io: CliIo): Promise<number> {
  const file = parsed.positional[1]

  if (!file) throw new UsageError('verify identity needs a presentation file')

  const finality = parsed.options.get('finality') ?? 'finalized'

  if (finality !== 'finalized' && finality !== 'latest') throw new UsageError('--finality is "finalized" or "latest"')

  // A presentation is handed to the library as text, so a file that is not JSON is its MalformedExport, not a usage error.
  let document: string

  try {
    document = fs.readFileSync(file, 'utf8')
  } catch {
    throw new UsageError(`Cannot read the presentation at ${file}`)
  }

  const manifest = parsed.options.has('manifest') ? readJson(required(parsed, 'manifest'), 'manifest') : undefined
  const rpc = parsed.options.has('rpc') ? jsonRpcTransport(required(parsed, 'rpc')) : undefined
  const report = await verifyPresentation(document, { manifest, rpc, finality, expectedSubject: parsed.options.get('subject') })

  if (parsed.flags.has('json')) {
    io.out(JSON.stringify(report, null, 2))
  } else {
    io.out(`Result: ${report.result}`)
    io.out(report.detail)

    if (report.subject) io.out(`Subject: ${report.subject}`)
    if (report.anchor) io.out(`Registry: ${report.anchor.registry} on chain ${report.anchor.chainId}, version ${report.anchor.version}`)
    if (isWithdrawn(report)) io.out('Withdrawn: the subject has taken this profile down')
    if (report.result === 'SelfSignedOnly') io.out('Self-signed only: authorship is shown; currency and withdrawal are not')

    for (const field of report.disclosed) io.out(`  ${field.pointer} = ${JSON.stringify(field.value)}`)
  }

  io.out(blockLine(report))

  return identityExit(report)
}

function origin(parsed: Arguments, io: CliIo): number {
  const file = parsed.positional[1]

  if (!file) throw new UsageError('verify origin needs a certificate file')

  const certificate = readJson(file, 'certificate') as OriginCertificate
  const verdict = verifyOrigin(certificate)
  const failures = failuresOf(certificate, verdict, parsed.options.get('signer'))
  const qualifications = qualificationsOf(verdict)

  if (parsed.flags.has('json')) {
    io.out(JSON.stringify({ verdict, failures, qualifications }, null, 2))
  } else {
    io.out(`Hire: ${verdict.contractId}`)

    for (const version of verdict.versions) {
      io.out(`Terms version ${version.termsVersion}: ${version.disclosure}${version.sameEngagement ? '' : ', names another engagement'}`)
    }
    for (const allocation of verdict.allocations) {
      io.out(`Allocation ${allocation.allocationId}: signed by ${allocation.signer}, terms ${allocation.termsDisclosure}`)
    }
  }

  for (const failure of failures) io.err(`Refuted: ${failure}`)
  for (const qualification of qualifications) io.err(`Unproven: ${qualification}`)

  if (failures.length > 0) return EXIT.refuted

  return qualifications.length > 0 ? EXIT.undetermined : EXIT.verified
}

/** Runs the command and answers its exit status. Never throws. */
export async function run(argv: readonly string[], io: CliIo): Promise<number> {
  try {
    const parsed = parse(argv)

    if (parsed.flags.has('help') || parsed.positional.length === 0) {
      io.out(USAGE)

      return parsed.flags.has('help') ? EXIT.verified : EXIT.usage
    }

    switch (parsed.positional[0]) {
      case 'identity':
        return await identity(parsed, io)
      case 'origin':
        return origin(parsed, io)
      default:
        throw new UsageError(`Unknown command ${parsed.positional[0]}`)
    }
  } catch (error) {
    if (error instanceof UsageError || error instanceof ManifestError) {
      io.err(error.message)
      io.err(USAGE)

      return EXIT.usage
    }

    io.err(error instanceof Error ? error.message : String(error))

    return EXIT.usage
  }
}

if (require.main === module) {
  run(process.argv.slice(2), { out: (line) => console.log(line), err: (line) => console.error(line) }).then((status) => {
    process.exitCode = status
  })
}
