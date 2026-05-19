import { createQuery } from '@farfetched/core'

import type { Balance, Transaction } from './types'

const MOCK_BALANCE: Balance = {
  amount: 1284.5,
  currency: 'USDT',
  tonAddress: 'UQAaPlMqz2Z1m4N5o6P7q8R9s0T1u2V3w4X5y6Z7a8B9c0Dx',
  ethAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    type: 'topUp',
    status: 'confirmed',
    amount: 500,
    currency: 'USDT',
    createdAt: '2026-05-18T10:32:00.000Z',
    hash: '6a5b9c7e2f3d4e5f6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9',
  },
  {
    id: 'tx-2',
    type: 'payout',
    status: 'pending',
    amount: 120.5,
    currency: 'USDT',
    createdAt: '2026-05-17T18:14:00.000Z',
  },
  {
    id: 'tx-3',
    type: 'topUp',
    status: 'failed',
    amount: 50,
    currency: 'USDT',
    createdAt: '2026-05-16T09:02:00.000Z',
  },
]

export const balanceQuery = createQuery({
  handler: async (): Promise<Balance> => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return MOCK_BALANCE
  },
})

export const transactionsQuery = createQuery({
  handler: async (): Promise<Transaction[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return MOCK_TRANSACTIONS
  },
})
