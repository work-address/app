import { hexlify } from 'ethers'

import { LEAF_COUNT, SCHEMA_ID_V1 } from './constants'
import { ProfileError } from './errors'
import { canonicalJson } from './jcs'
import { secureRandomBytes } from './random'
import {
  FIRST_RESERVED_SLOT,
  PROFILE_SCHEMA_V1,
  canonicalFieldValue,
  fieldDefinition,
  isCanonicalFieldValue,
  slotDefinition,
} from './schema'
import { toSubject } from './subject'
import { isBytes32, profileLeaf, proofFromLevels, treeLevels } from './tree'

import type { RandomBytes } from './random'
import type { FieldKey, FieldValue, ProfileFields } from './schema'
import type { Subject } from './subject'

export type CommittedField = {
  slot: number
  key: FieldKey
  pointer: string
  value: FieldValue
  valueJcs: string
  salt: string
  leaf: string
}

export type Filler = { slot: number; leaf: string }

/**
 * A holder's whole tree. Everything in it is private: `fields` holds every
 * value and salt, and a presentation copies out only the slots chosen.
 */
export type ProfileTree = {
  schemaId: typeof SCHEMA_ID_V1
  subject: Subject
  fields: CommittedField[]
  fillers: Filler[]
  leaves: string[]
  root: string
  levels: string[][]
}

const ZERO_WORD = `0x${'0'.repeat(64)}`

function randomWord(randomBytes: RandomBytes, purpose: string): string {
  const bytes = randomBytes(32)

  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new ProfileError('InvalidRandomness', `A ${purpose} is 32 random bytes`)
  }

  return hexlify(bytes)
}

/**
 * Builds a fresh tree: a new random salt for every filled slot and a new
 * random filler for every other one, drawn in slot order. Every call gives a
 * different root for the same fields, which is what a new published version
 * needs.
 */
export function buildProfileTree(input: {
  subject: Subject | string
  fields: ProfileFields
  randomBytes?: RandomBytes
}): ProfileTree {
  const subject = toSubject(input.subject)
  const values = new Map<number, FieldValue>()

  for (const [key, raw] of Object.entries(input.fields)) {
    const definition = fieldDefinition(key)

    if (!definition) throw new ProfileError('UnknownField', `Schema v1 has no field ${key}`)

    const value = canonicalFieldValue(definition, raw)

    if (value !== null) values.set(definition.slot, value)
  }

  const randomBytes = input.randomBytes ?? secureRandomBytes
  const fields: { slot: number; value: FieldValue; salt: string }[] = []
  const fillers: Filler[] = []

  for (let slot = 0; slot < LEAF_COUNT; slot += 1) {
    const value = values.get(slot)

    if (value === undefined) {
      fillers.push({ slot, leaf: randomWord(randomBytes, 'filler') })
    } else {
      fields.push({ slot, value, salt: randomWord(randomBytes, 'salt') })
    }
  }

  return assembleProfileTree({ subject, fields, fillers })
}

/**
 * Assembles a tree from values, salts and fillers that already exist: a
 * restored export, or test vectors. Everything is checked. Each slot is
 * covered exactly once, reserved slots hold fillers, values are canonical,
 * and no two random words repeat, because a repeat means a broken RNG.
 */
export function assembleProfileTree(input: {
  subject: Subject | string
  fields: readonly { slot: number; pointer?: string; value: unknown; salt: string }[]
  fillers: readonly Filler[]
}): ProfileTree {
  const subject = toSubject(input.subject)
  const leaves: (string | undefined)[] = new Array(LEAF_COUNT).fill(undefined)
  const words = new Set<string>()
  const fields: CommittedField[] = []

  const claim = (slot: number, word: string, purpose: string) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= LEAF_COUNT) {
      throw new ProfileError('InvalidDocument', `Slot ${slot} is outside the 32-leaf tree`)
    }
    if (leaves[slot] !== undefined) {
      throw new ProfileError('InvalidDocument', `Slot ${slot} appears twice`)
    }
    if (!isBytes32(word) || word === ZERO_WORD) {
      throw new ProfileError('InvalidRandomness', `The ${purpose} of slot ${slot} must be 32 non-zero bytes as lowercase hex`)
    }
    if (words.has(word)) {
      throw new ProfileError('InvalidRandomness', `The ${purpose} of slot ${slot} repeats another random word`)
    }

    words.add(word)
  }

  for (const field of input.fields) {
    const definition = slotDefinition(field.slot)

    if (!definition || field.slot >= FIRST_RESERVED_SLOT) {
      throw new ProfileError('InvalidDocument', `Slot ${field.slot} is reserved in schema v1 and cannot hold a field`)
    }
    if (field.pointer !== undefined && field.pointer !== definition.pointer) {
      throw new ProfileError('InvalidDocument', `Slot ${field.slot} is ${definition.pointer}, not ${field.pointer}`)
    }
    if (!isCanonicalFieldValue(definition, field.value)) {
      throw new ProfileError('InvalidField', `The value of ${definition.pointer} is not in canonical form`)
    }

    claim(field.slot, field.salt, 'salt')

    const valueJcs = canonicalJson(field.value)
    const leaf = profileLeaf({
      schemaId: SCHEMA_ID_V1,
      leafSubject: subject.leafSubject,
      slot: field.slot,
      pointer: definition.pointer,
      valueJcs,
      salt: field.salt,
    })

    leaves[field.slot] = leaf
    fields.push({
      slot: field.slot,
      key: definition.key,
      pointer: definition.pointer,
      value: field.value,
      valueJcs,
      salt: field.salt,
      leaf,
    })
  }

  for (const filler of input.fillers) {
    claim(filler.slot, filler.leaf, 'filler')
    leaves[filler.slot] = filler.leaf
  }

  const missing = leaves.findIndex((leaf) => leaf === undefined)

  if (missing !== -1) {
    throw new ProfileError('InvalidDocument', `Slot ${missing} has neither a field nor a filler`)
  }

  const complete = leaves as string[]
  const levels = treeLevels(complete)

  fields.sort((a, b) => a.slot - b.slot)

  return {
    schemaId: SCHEMA_ID_V1,
    subject,
    fields,
    fillers: complete
      .map((leaf, slot) => ({ slot, leaf }))
      .filter(({ slot }) => !fields.some((field) => field.slot === slot)),
    leaves: complete,
    root: levels[levels.length - 1][0],
    levels,
  }
}

/** The field a key or slot names, if the tree holds it. */
export function committedField(tree: ProfileTree, which: FieldKey | number): CommittedField | undefined {
  return tree.fields.find((field) => (typeof which === 'number' ? field.slot === which : field.key === which))
}

/** The 5-element proof of one committed field. */
export function proofFor(tree: ProfileTree, which: FieldKey | number): string[] {
  const field = committedField(tree, which)

  if (!field) {
    throw new ProfileError('NotDisclosable', `The tree holds no field ${String(which)}; its slot is a filler`)
  }

  return proofFromLevels(tree.levels, field.slot)
}

/** Every schema v1 slot with a pointer, for UIs that list what can be shown. */
export const DISCLOSABLE_FIELDS = PROFILE_SCHEMA_V1.map(({ slot, key, pointer }) => ({ slot, key, pointer }))
