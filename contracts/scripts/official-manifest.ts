import fs from 'fs'
import path from 'path'
import { getAddress } from 'ethers'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import {
  OFFICIAL_FORMAT,
  OFFICIAL_VERSION,
  officialDigest,
  officialTypedData,
  verifyOfficialManifest,
} from '../packages/identity/src'

import type { OfficialDeployment, OfficialDeploymentsBody, OfficialManifest } from '../packages/identity/src'

import { LOCAL_CHAIN_ID } from './deployment'
import { DEPLOYMENTS_DIR } from './local-chain'

import type { DeploymentManifest } from './deployment'

/**
 * The publisher's side of deployments/official.json (the reader's side is
 * `verifyOfficialManifest` in packages/identity, and `verify manifest` on the
 * command line).
 *
 * Nothing here holds the publisher's key. `official:manifest` builds the
 * EIP-712 request from deployment manifests the deploy wrote and prints it;
 * the publisher signs it in their own wallet (`eth_signTypedData_v4`, which
 * a hardware wallet shows field by field); the same command, given the
 * signature, checks that it recovers the publisher and only then writes the
 * file. For the local chain alone, where every key is a public Hardhat test
 * key anyway, the node itself can sign.
 */

export const OFFICIAL_PATH = path.join(DEPLOYMENTS_DIR, 'official.json')

/** The contracts release a deployment was built from: this package's version. */
export function currentRelease(): string {
  const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }

  return `contracts-${version}`
}

/** What the allowlist says about one deployment, from the manifest its deploy wrote. */
export function officialDeploymentFrom(manifest: DeploymentManifest, release: string): OfficialDeployment {
  if (manifest.dryRun) {
    throw new Error(`${manifest.network} is a dry run: its addresses exist nowhere, and no allowlist may name them.`)
  }

  return {
    chainId: manifest.chainId,
    release,
    escrow: getAddress(manifest.escrow.address),
    token: getAddress(manifest.token.address),
    tokenDecimals: manifest.token.decimals,
    identityRegistry: getAddress(manifest.identityRegistry.address),
    originSigner: getAddress(manifest.originSigner),
    feeRecipient: getAddress(manifest.feeRecipient),
    deployBlock: manifest.deployBlock,
    escrowCodeHash: manifest.escrow.runtimeCodeHash,
    registryCodeHash: manifest.identityRegistry.runtimeCodeHash,
  }
}

/** The signed body for a set of deployment manifest files. `issuedAt` is Unix seconds, and is part of what is signed. */
export function officialBody(files: string[], options: { release: string; issuedAt: number }): OfficialDeploymentsBody {
  if (files.length === 0) {
    throw new Error('Name at least one deployment manifest to vouch for')
  }

  return {
    issuedAt: options.issuedAt,
    deployments: files.map((file) =>
      officialDeploymentFrom(JSON.parse(fs.readFileSync(file, 'utf8')) as DeploymentManifest, options.release),
    ),
  }
}

/** The JSON a wallet's `eth_signTypedData_v4` takes as its second parameter. */
export function signingRequest(body: OfficialDeploymentsBody): string {
  const { domain, types, primaryType, message } = officialTypedData(body)

  return JSON.stringify({
    domain,
    types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }], ...types },
    primaryType,
    message,
  })
}

/**
 * The signed document, once `signature` is shown to recover `publisher` over
 * exactly `body`. Throws otherwise, so a wrong or stale signature never
 * reaches a file.
 */
export function assembleOfficialManifest(
  body: OfficialDeploymentsBody,
  publisher: string,
  signature: string,
): OfficialManifest {
  const manifest: OfficialManifest = {
    $schema: './official.schema.json',
    format: OFFICIAL_FORMAT,
    version: OFFICIAL_VERSION,
    publisher: getAddress(publisher),
    issuedAt: body.issuedAt,
    deployments: officialTypedData(body).message.deployments,
    signature,
  }

  verifyOfficialManifest(manifest, publisher)

  return manifest
}

/**
 * Signs with one of the local node's own accounts: only a list of local
 * deployments, whose keys Hardhat prints on start, so the result is a
 * development allowlist and never an official one.
 */
export async function signLocally(
  hre: Pick<HardhatRuntimeEnvironment, 'network'>,
  body: OfficialDeploymentsBody,
  publisher: string,
): Promise<string> {
  const foreign = body.deployments.filter((entry) => entry.chainId !== LOCAL_CHAIN_ID)

  if (foreign.length > 0) {
    throw new Error(
      `Only a list of local (${LOCAL_CHAIN_ID}) deployments is signed by the node; chain ${foreign[0].chainId} ` +
        "needs the publisher's own wallet.",
    )
  }

  return (await hre.network.provider.request({
    method: 'eth_signTypedData_v4',
    params: [getAddress(publisher), signingRequest(body)],
  })) as string
}

export type OfficialCommandOptions = {
  deployments: string[]
  publisher: string
  issuedAt?: string
  release?: string
  signature?: string
  signLocally?: boolean
  out?: string
  log?: (line: string) => void
}

/** `official:manifest`. Returns the written document, or null when it only printed the request to sign. */
export async function runOfficialManifest(
  hre: Pick<HardhatRuntimeEnvironment, 'network'>,
  options: OfficialCommandOptions,
): Promise<OfficialManifest | null> {
  const log = options.log ?? console.log
  const issuedAt = options.issuedAt === undefined ? Math.floor(Date.now() / 1000) : Number(options.issuedAt)

  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) {
    throw new Error(`--issued-at is Unix seconds, not ${options.issuedAt}`)
  }

  const body = officialBody(options.deployments, { release: options.release ?? currentRelease(), issuedAt })
  const signature = options.signLocally ? await signLocally(hre, body, options.publisher) : options.signature

  if (signature === undefined) {
    log(`# EIP-712 digest ${officialDigest(body)}`)
    log(`# Sign with ${getAddress(options.publisher)} (eth_signTypedData_v4), then run this again with`)
    log(`# --issued-at ${issuedAt} --signature <the signature>`)
    log(signingRequest(body))
    return null
  }

  const manifest = assembleOfficialManifest(body, options.publisher, signature)
  const out = options.out ?? OFFICIAL_PATH

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`)
  log(`Wrote ${out}: ${manifest.deployments.length} deployment(s), signed by ${manifest.publisher}`)

  return manifest
}
