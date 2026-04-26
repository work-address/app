export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthTokenData {
  address: string;
  id: string;
  emailOrPhone?: string;
}

export interface IAuthTonPayload {
  address: string;
  network: string;
  public_key: string;
  proof: {
    timestamp: number;
    domain: {
      lengthBytes: number;
      value: string;
    };
    payload: string;
    signature: string;
    state_init: string;
  };
}

export enum EAuthTimeTrackerState {
  INIT = 'Initialization',
  LOGIN = 'Login',
  CONNECTED = 'Connected',
}
