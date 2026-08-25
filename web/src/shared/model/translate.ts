import i18n from '../i18n/i18n'

/**
 * Translation for code that runs outside the React tree. i18next is a
 * singleton, so a model can produce user-facing copy without a component
 * having to pass `t` in.
 */
export const translate = (
  key: string,
  values?: Record<string, unknown>,
): string => i18n.t(key, values ?? {})
