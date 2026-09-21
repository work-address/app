import { createEvent, createStore } from 'effector'

import type { ProfileExport } from '@/shared/vendor/identity'

/**
 * How long the private export lives in this tab.
 *
 * The export is every field's value together with its salt - the secret half
 * of an identity, and the only thing in this feature that can reconstruct a
 * commitment. It is fetched when the holder asks to see it and it must not
 * outlive that moment, so its lifetime is stated here rather than falling out
 * of whichever effect happens to reset it.
 *
 * Framework-free and free of the API barrel on purpose: this is the rule
 * about a secret's lifetime, and a rule worth testing is worth being able to
 * test without a DOM.
 */

/** The export arrived from the API. */
export const identityExportReceived = createEvent<ProfileExport>()

/**
 * The dialog showing it closed, by any route - the button, the escape key,
 * or the card unmounting under it.
 */
export const identityExportDismissed = createEvent()

/**
 * What this instance hosts for the holder changed, so the copy in hand is no
 * longer the current one: a publish or a removal.
 */
export const identityExportInvalidated = createEvent()

export const $identityExport = createStore<ProfileExport | null>(null)
  .on(identityExportReceived, (_, document) => document)
  .reset(identityExportDismissed, identityExportInvalidated)
