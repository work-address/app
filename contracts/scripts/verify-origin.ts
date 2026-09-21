/**
 * Checks a Work Address origin certificate offline, from the command line.
 *
 * The checks themselves live in the open verifier library,
 * packages/identity/src/origin.ts, where the receipt verifier and the
 * browser use them too; this file re-exports them, so everything that
 * imported the script keeps working, and keeps the command:
 *
 *   npx hardhat run scripts/verify-origin.ts --no-compile -- certificate.json
 *   ORIGIN_SIGNER=0x... npx ts-node scripts/verify-origin.ts certificate.json
 *
 * With ORIGIN_SIGNER set, a recovered address that is not it fails the run;
 * without it the recovered address is only reported. `packages/identity/bin/verify
 * origin` is the same check with the chain's own `originSigner()` beside it.
 *
 * Exit status: 0 when every disclosed version opens and every signature
 * holds, 1 when something in the certificate is wrong, 3 when nothing is
 * wrong but the terms are unproven (a certificate that declares format
 * version null: see origin.ts).
 */
import {
  failuresOf,
  qualificationsOf,
  verifyOrigin,
} from '../packages/identity/src/origin'

import type { OriginCertificate } from '../packages/identity/src/origin'

export * from '../packages/identity/src/origin'

/** The CLI: read a certificate, print the verdict, exit non-zero unless it is proven. */
async function main(): Promise<void> {
  const fs = await import('node:fs')
  const file = process.argv.slice(2).filter((argument) => argument !== '--')[0]

  if (!file) {
    throw new Error('Usage: verify-origin.ts <certificate.json>')
  }

  const certificate: OriginCertificate = JSON.parse(
    fs.readFileSync(file, 'utf8'),
  )
  const verdict = verifyOrigin(certificate)
  const failures = failuresOf(certificate, verdict, process.env.ORIGIN_SIGNER)
  const qualifications = qualificationsOf(verdict)

  console.log(JSON.stringify(verdict, null, 2))

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }

  if (qualifications.length > 0) {
    console.error(qualifications.join('\n'))
    process.exitCode = 3
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
