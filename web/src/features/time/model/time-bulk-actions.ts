/** What the phone layout's bulk picker can do to the selection. */
export type TimeBulkAction = 'delete' | 'removeScreenshots' | 'removeProcesses'

/** In the order the picker lists them. */
export const TIME_BULK_ACTIONS = [
  'delete',
  'removeScreenshots',
  'removeProcesses',
] as const satisfies readonly TimeBulkAction[]

/**
 * Whether the selection allows the action.
 *
 * An invoice keeps the hours it bills, and the API refuses the whole delete
 * (409) if one selected entry is on an invoice - so, as on the desktop bulk
 * bar, delete is not offered for such a selection. Screenshots and processes
 * are monitoring evidence rather than billing, and stay removable.
 */
export const isTimeBulkActionAvailable = (
  action: TimeBulkAction,
  selection: { hasInvoiced: boolean },
): boolean => action !== 'delete' || !selection.hasInvoiced
