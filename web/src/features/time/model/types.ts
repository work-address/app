export type TimePaymentStatus = 'Paid' | 'Unpaid'

export type TimeRow = {
  key: string
  dateRange: string
  date: string
  projectName: string
  note: string
  timeActive: number
  paymentStatus: TimePaymentStatus
  keyboard: string
  mouse: string
  mouseDistance: string
  screenshot?: string
}

export type TimeFormFilters = {
  timeActiveMin: string
  timeActiveMax: string
  keyboardMin: string
  keyboardMax: string
  mouseMin: string
  mouseMax: string
  mouseDistanceMin: string
  mouseDistanceMax: string
}

/** Which presentation the worklogs section is showing. */
export type TimeView = 'list' | 'grid'

/**
 * How busy a tracked slot was, as a closed set so the CSS that tints the grid
 * and the TypeScript that decides the tone cannot drift apart.
 */
export type TimeActivityTone = 'low' | 'medium' | 'high'
