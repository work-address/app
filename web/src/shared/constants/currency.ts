type BaseCurrency = {
  readonly code: string
  readonly name: string
  readonly cryptoCode: string
  readonly symbol: string
}

const defineBaseCurrency = <const T extends BaseCurrency>(currency: T): T =>
  currency

export const BASE_CURRENCY = defineBaseCurrency({
  code: 'USD',
  name: 'US Dollar',
  cryptoCode: 'USDT',
  symbol: '$',
})

export type BaseCurrencyCode = typeof BASE_CURRENCY.code
