import type { BaseCurrencyCode } from '@/shared/constants/currency'

export type Balance = {
  amount: number
  currency: BaseCurrencyCode
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
  currency: BaseCurrencyCode
  createdAt: string
  hash?: string
}
