export enum EUserRole {
  ROLE_USER = 'ROLE_USER',
}

export interface IUser {
  address: string
}

/** The chain an account's address belongs to, by its spelling. */
export enum EWalletChain {
  EVM = 'evm',
  TON = 'ton',
  SOLANA = 'solana',
}
