export interface IAuthTokens {
  accessToken: string
  refreshToken: string
}

export interface IAuthTokenData {
  address: string
  id: string
}

export enum EAuthTimeTrackerState {
  INIT = 'Initialization',
  LOGIN = 'Login',
  CONNECTED = 'Connected',
}
