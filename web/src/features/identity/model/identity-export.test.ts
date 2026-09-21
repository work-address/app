import { allSettled, fork } from 'effector'
import { describe, expect, it } from 'vitest'

import {
  $identityExport,
  identityExportDismissed,
  identityExportInvalidated,
  identityExportReceived,
} from './identity-export'

import type { ProfileExport } from '@/shared/vendor/identity'

/**
 * A stand-in for the real document: what matters here is that it carries
 * salts, not that it is a valid export.
 */
const EXPORT = {
  version: 1,
  subject: 'did:pkh:eip155:31337:0x0000000000000000000000000000000000000001',
  schemaId: 'profile.v1',
  fields: {
    name: { value: 'Ada Lovelace', salt: '0xdeadbeef' },
    title: { value: 'Analyst', salt: '0xfeedface' },
  },
} as unknown as ProfileExport

/**
 * IDENTITY-FOLLOWUPS (2): the export holds every field's value together with
 * its salt, so it must not outlive the dialog that fetched it. Before this it
 * was cleared only on publish or removal, and closing the dialog left the
 * secrets in the store for the rest of the session.
 */
describe('identity export lifetime', () => {
  const holding = async () => {
    const scope = fork()

    await allSettled(identityExportReceived, { scope, params: EXPORT })

    expect(scope.getState($identityExport)).toEqual(EXPORT)

    return scope
  }

  it('holds the document while the dialog is open', async () => {
    const scope = await holding()

    expect(scope.getState($identityExport)).toEqual(EXPORT)
  })

  it('drops the document, salts and all, when the dialog closes', async () => {
    const scope = await holding()

    await allSettled(identityExportDismissed, { scope })

    expect(scope.getState($identityExport)).toBeNull()
  })

  it('drops it when what this instance hosts changes', async () => {
    const scope = await holding()

    await allSettled(identityExportInvalidated, { scope })

    expect(scope.getState($identityExport)).toBeNull()
  })

  it('can be fetched again after it was dropped', async () => {
    const scope = await holding()

    await allSettled(identityExportDismissed, { scope })
    await allSettled(identityExportReceived, { scope, params: EXPORT })

    expect(scope.getState($identityExport)).toEqual(EXPORT)
  })

  /** Closing an export that was never fetched is not an error. */
  it('is a no-op when nothing was fetched', async () => {
    const scope = fork()

    await allSettled(identityExportDismissed, { scope })

    expect(scope.getState($identityExport)).toBeNull()
  })
})
