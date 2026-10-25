import { Faker, base, en } from '@faker-js/faker'

/** A stable 31-bit number for a string. */
export function hashSeed(text: string): number {
  let hash = 2_166_136_261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return Math.abs(hash) % 2_147_483_647
}

/**
 * A faker of its own for each key, so one generator drawing more never
 * shifts what another draws: the same world is the same on every load.
 */
export function seeded(key: string): Faker {
  const faker = new Faker({ locale: [en, base] })
  faker.seed(hashSeed(key))
  return faker
}
