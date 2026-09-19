import { faker } from '@faker-js/faker'

/**
 * The seed the exported spec's example values are drawn from.
 *
 * Entities and controllers take their OpenAPI example ids and nonces from
 * faker when their decorators run, at import. Unseeded, every export drew
 * new ones, so a regenerated spec never matched the committed one and a
 * regenerate-and-diff check could not pass. Seeded, the same code exports
 * the same bytes; a change that adds or removes a draw moves the ids after
 * it, which a regenerate shows once.
 *
 * Imported by the export script ahead of the app, so the seed is set before
 * any decorator draws. Nothing else imports it: at runtime faker still
 * serves the test fixtures and the signer unseeded.
 */
export const OPENAPI_EXAMPLE_SEED = 20240121

faker.seed(OPENAPI_EXAMPLE_SEED)
