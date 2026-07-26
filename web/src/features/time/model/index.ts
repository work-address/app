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
