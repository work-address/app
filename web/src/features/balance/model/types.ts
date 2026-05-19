export type Balance = {
  amount: number
  currency: 'USDT'
  tonAddress: string
  ethAddress: string
}

export type TransactionType = 'topUp' | 'payout'
export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

export type Transaction = {
  id: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: 'USDT'
  createdAt: string
  hash?: string
}
