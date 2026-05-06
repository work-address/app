/**
 * Stable entry for workspace consumers (API tests, scripts).
 * Re-exports generated SDK plus {@link createClient} helpers not bundled in codegen index.
 */
export * from './features/shared/api/generated/index'
export { createClient, createConfig } from './features/shared/api/generated/client/index'
