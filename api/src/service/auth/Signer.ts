import {injectable, inject} from 'inversify';
import * as web3 from 'web3';
import * as crypto from 'crypto';

import faker from 'faker';

import {IConfigParameters} from '../../interface/IConfigParameters';

@injectable()
export class Signer {
  @inject('parameters')
  protected parameters: IConfigParameters;

  public generateNonce(): string {
    const nonce = `${faker.datatype.uuid()}-${this.parameters.jwtSecret}`;

    return crypto.createHash('md5').update(nonce).digest('hex');
  }

  public verify(nonce: string, signature: string, address: string): boolean {
    const recoveredAddress = web3.eth.accounts.recover(nonce, signature);

    return recoveredAddress === address;
  }
}
