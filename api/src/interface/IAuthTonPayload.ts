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
