/** Whether a list's select-all box is off, on, or partly on. */
export type TimeSelectAllState = boolean | 'indeterminate'

/**
 * The select-all state for the loaded entries: checked only when every one
 * is selected, and indeterminate while some are. Ids selected elsewhere (on
 * a page no longer loaded, say) do not count towards it.
 */
export const getTimeSelectAllState = (
  ids: string[],
  selection: Record<string, boolean>,
): TimeSelectAllState => {
  const selected = ids.filter((id) => selection[id]).length

  if (ids.length > 0 && selected === ids.length) {
    return true
  }

  return selected > 0 ? 'indeterminate' : false
}

/**
 * The selection after pressing select-all: everything loaded when it was not
 * all selected yet, nothing when it was.
 */
export const toggleTimeSelectAll = (
  ids: string[],
  selection: Record<string, boolean>,
): Record<string, boolean> =>
  getTimeSelectAllState(ids, selection) === true
    ? {}
    : Object.fromEntries(ids.map((id) => [id, true]))
