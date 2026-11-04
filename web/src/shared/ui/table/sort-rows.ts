import type { SortOrder } from '../sort-select'

type SortValue = string | number | null | undefined

const isMissing = (value: SortValue): value is null | undefined | '' =>
  value === undefined || value === null || value === ''

/** Numbers by value; text without regard to case, and "10" after "2" within it. */
const compareValues = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: 'base',
      })

/**
 * Rows in the order asked for, for a table that holds all of its rows and so
 * sorts them itself. The input is left alone.
 *
 * A row with no value goes last in both directions: flipping the order should
 * not bring a block of dashes to the top. `tieBreak` is read ascending either
 * way, so equal rows do not trade places when the direction flips.
 */
export const sortRowsBy = <T>(
  rows: readonly T[],
  read: (row: T) => SortValue,
  order: SortOrder,
  tieBreak: (row: T) => string = () => '',
): T[] => {
  const direction = order === 'DESC' ? -1 : 1

  return [...rows].sort((a, b) => {
    const left = read(a)
    const right = read(b)

    if (isMissing(left) || isMissing(right)) {
      const missingFirst = Number(isMissing(left)) - Number(isMissing(right))

      return missingFirst || compareValues(tieBreak(a), tieBreak(b))
    }

    return (
      direction * compareValues(left, right) ||
      compareValues(tieBreak(a), tieBreak(b))
    )
  })
}
