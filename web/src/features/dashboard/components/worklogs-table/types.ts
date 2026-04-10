export type PaymentStatus = 'Paid' | 'Unpaid'

export type WorklogRow = {
  key: string
  dateRange: string
  date: string
  projectName: string
  note: string
  timeActive: string
  paymentStatus: PaymentStatus
  keyboard: string
  mouse: string
  mouseDistance: string
  screenshot?: string
}

export type WorklogFormFilters = {
  timeActiveMin: string
  timeActiveMax: string
  keyboardMin: string
  keyboardMax: string
  mouseMin: string
  mouseMax: string
  mouseDistanceMin: string
  mouseDistanceMax: string
}
