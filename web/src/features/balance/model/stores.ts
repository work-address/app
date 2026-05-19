import { combine } from 'effector'

import { balanceQuery, transactionsQuery } from './queries'

import type { Balance, Transaction } from './types'

export const $balance = combine(
  balanceQuery.$data,
  (data): Balance | null => data ?? null,
)

export const $transactions = combine(
  transactionsQuery.$data,
  (data): Transaction[] => data ?? [],
)

export const $balanceLoading = combine(
  balanceQuery.$pending,
  transactionsQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)
