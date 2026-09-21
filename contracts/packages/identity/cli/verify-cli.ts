import fs from 'node:fs'

import {
  ManifestError,
  buildReceipts,
  failuresOf,
  findAllocationsPaidTo,
  isWithdrawn,
  jsonRpcTransport,
  qualificationsOf,
  serializeReceipt,
  verifyOrigin,
  verifyPresentation,
  verifyReceipts,
} from '../src'

import type { OriginCertificate, ReceiptReport, VerificationReport } from '../src'

/**
 * The independent verifier as a command. It reads files the holder handed
 * over, asks the RPC endpoint named on the command line, and nothing else:
 * no Work Address host is contacted, and none could change the answer.
 *
 * Exit status, so a script can tell the three apart:
 *
 *   0  verified: an identity that is Current or SelfSignedOnly, a certificate
 *      whose every version opens, receipts that are every one Verified
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
  verify receipt <receipt.json>... --manifest <deployment.json> --rpc <url>
                  [--subject <address>] [--certificate <certificate.json>]...
                  [--finality finalized|latest] [--json]
  verify receipts --subject <address> --manifest <deployment.json> --rpc <url>
                  [--allocation <id>]... [--escrow <address>] [--out <directory>]
                  [--finality finalized|latest] [--json]

  --manifest   deployment manifest (deployments/<network>.json): the registries and
               escrows you accept. A copy of either contract proves nothing.
  --rpc        a JSON-RPC endpoint you trust. The only host this command contacts.
  --subject    refuse a document about any other account.
  --finality   "finalized" (default) accepts only the node's finalized block;
               "latest" reads the head, for a development chain.
  --signer     the origin signer the deployment publishes; a certificate signed
               by anyone else is refused.
  --certificate  a hire's origin certificate: opens the terms hash of the receipts
               it discloses, held to the origin signer the escrow itself names.
  --allocation   an allocation to build a receipt for; a hint from anywhere.
               Without any, every funding event of the listed escrows is read.
  --out        write each receipt there as <allocationId>.json.

Exit status: 0 verified, 1 refuted or not recognised, 2 usage, 3 undetermined.`

class UsageError extends Error {}

type Arguments = { positional: string[]; options: Map<string, string>; repeated: Map<string, string[]>; flags: Set<string> }

const VALUE_OPTIONS = new Set(['manifest', 'rpc', 'subject', 'finality', 'signer', 'escrow', 'out'])
const REPEATED_OPTIONS = new Set(['allocation', 'certificate'])
const FLAGS = new Set(['json', 'help'])

function parse(argv: readonly string[]): Arguments {
  const parsed: Arguments = { positional: [], options: new Map(), repeated: new Map(), flags: new Set() }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (!argument.startsWith('--')) {
      parsed.positional.push(argument)
      continue
    }

    const [name, inline] = argument.slice(2).split(/=(.*)/s, 2)

    if (FLAGS.has(name)) {
      parsed.flags.add(name)
    } else if (VALUE_OPTIONS.has(name) || REPEATED_OPTIONS.has(name)) {
      const value = inline ?? argv[(index += 1)]

      if (value === undefined) throw new UsageError(`--${name} needs a value`)

      if (REPEATED_OPTIONS.has(name)) parsed.repeated.set(name, [...(parsed.repeated.get(name) ?? []), value])
      else parsed.options.set(name, value)
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

  const finality = finalityOf(parsed)

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

function finalityOf(parsed: Arguments): 'finalized' | 'latest' {
  const finality = parsed.options.get('finality') ?? 'finalized'

  if (finality !== 'finalized' && finality !== 'latest') throw new UsageError('--finality is "finalized" or "latest"')

  return finality
}

export function receiptExit(reports: readonly Pick<ReceiptReport, 'result' | 'accepted'>[]): number {
  if (reports.length > 0 && reports.every((report) => report.accepted)) return EXIT.verified

  const refuted = reports.some((report) => !report.accepted && report.result !== 'RpcUnavailable' && report.result !== 'NotFinal')

  return refuted || reports.length === 0 ? EXIT.refuted : EXIT.undetermined
}

async function receipt(parsed: Arguments, io: CliIo): Promise<number> {
  const files = parsed.positional.slice(1)

  if (files.length === 0) throw new UsageError('verify receipt needs at least one receipt file')

  const manifest = readJson(required(parsed, 'manifest'), 'manifest')
  const rpc = jsonRpcTransport(required(parsed, 'rpc'))
  const certificates = (parsed.repeated.get('certificate') ?? []).map((file) => readJson(file, 'certificate') as OriginCertificate)
  const documents = files.map((file) => {
    try {
      return fs.readFileSync(file, 'utf8')
    } catch {
      throw new UsageError(`Cannot read the receipt at ${file}`)
    }
  })
  const options = { manifest, rpc, finality: finalityOf(parsed), expectedSubject: parsed.options.get('subject') }
  const { reports, summary } = await verifyReceipts(documents, { ...options, certificates })

  if (parsed.flags.has('json')) {
    io.out(JSON.stringify({ reports, summary }, null, 2))
  } else {
    reports.forEach((report, index) => {
      io.out(`${files[index]}: ${report.result}${report.duplicate ? ' (the same allocation as one above: counted once)' : ''}`)
      io.out(`  ${report.detail}`)

      if (report.terms) io.out(`  Terms: ${report.terms.disclosure}, hire ${report.terms.contractId}, signed by ${report.terms.signer}`)

      for (const qualification of report.terms?.qualifications ?? []) io.err(`Unproven: ${qualification}`)
    })

    for (const total of summary.totals) {
      io.out(`Paid through escrow: ${total.releases} releases, ${total.workerNet} base units of ${total.token} (${total.decimals} decimals) on chain ${total.chainId}`)
    }
  }

  io.out(summary.checkedAtBlock === null ? 'Block checked: none' : `Block checked: ${summary.checkedAtBlock}`)

  return receiptExit(reports)
}

async function receipts(parsed: Arguments, io: CliIo): Promise<number> {
  const subject = required(parsed, 'subject')
  const options = { manifest: readJson(required(parsed, 'manifest'), 'manifest'), rpc: jsonRpcTransport(required(parsed, 'rpc')), finality: finalityOf(parsed) }
  const escrow = parsed.options.get('escrow')
  const hinted = parsed.repeated.get('allocation')
  const allocationIds = hinted ?? (await findAllocationsPaidTo(subject, { ...options, escrow }))
  const build = await buildReceipts({ subject, allocationIds, escrow }, options)
  const out = parsed.options.get('out')

  if (out !== undefined) {
    fs.mkdirSync(out, { recursive: true })

    for (const built of build.receipts) fs.writeFileSync(`${out}/${built.source.allocationId}.json`, serializeReceipt(built))
  }

  if (parsed.flags.has('json')) {
    io.out(JSON.stringify(build, null, 2))
  } else {
    io.out(`Result: ${build.result}`)
    io.out(build.detail)

    for (const allocation of build.allocations) io.out(`  ${allocation.allocationId}: ${allocation.outcome}. ${allocation.detail}`)
  }

  io.out(build.checkedAtBlock === null ? 'Block checked: none' : `Block checked: ${build.checkedAtBlock} (${build.finalized ? 'finalized' : 'not finalized'})`)

  if (build.result === 'Built') return EXIT.verified

  return build.result === 'RegistryNotInManifest' ? EXIT.refuted : EXIT.undetermined
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
      case 'receipt':
        return await receipt(parsed, io)
      case 'receipts':
        return await receipts(parsed, io)
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
