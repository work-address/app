import { sample } from 'effector'

import { fetchBalance, resetBalance } from './events'
import { balanceQuery, transactionsQuery } from './queries'

sample({
  clock: fetchBalance,
  target: [balanceQuery.start, transactionsQuery.start],
})

sample({
  clock: resetBalance,
  target: [balanceQuery.reset, transactionsQuery.reset],
})

export { fetchBalance, resetBalance } from './events'
export { $balance, $transactions, $balanceLoading } from './stores'
export { BASE_CURRENCY } from '@/shared'
export type {
  Balance,
  Transaction,
  TransactionType,
  TransactionStatus,
} from './types'
