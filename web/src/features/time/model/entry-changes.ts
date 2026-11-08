import type { Time } from '@/entities/time'

/**
 * What this reader may change on an entry, so a control is only offered when
 * the API would accept it (SPEC.md, "An invoiced entry keeps its detail"). Only
 * its author changes an entry, and invoicing leaves them just the paid state.
 */
export const getEntryChanges = (
  entry: Pick<Time, 'isInvoiced' | 'user'> | Record<string, never>,
  readerId?: string,
) => {
  const isAuthor = Boolean(readerId) && entry.user?.id === readerId

  return {
    isAuthor,
    canMarkPaid: isAuthor,
    canEditNote: isAuthor && !entry.isInvoiced,
    canRemove: isAuthor && !entry.isInvoiced,
  }
}

/** Whether a selection holds an entry that deleting or removing would refuse. */
export const hasInvoicedEntry = (
  rows: Pick<Time, 'id' | 'isInvoiced'>[],
  ids: string[],
): boolean => {
  const selected = new Set(ids)

  return rows.some((row) => row.id && selected.has(row.id) && row.isInvoiced)
}
