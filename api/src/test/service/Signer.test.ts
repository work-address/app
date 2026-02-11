import * as web3 from 'web3';
import {expect} from 'chai';
import {suite, test} from '@testdeck/mocha';

import {AbstractDatabaseIntegration} from '../AbstractDatabase.integration';
import {Signer} from '../../service/auth/Signer';

@suite()
export class SignerTest extends AbstractDatabaseIntegration {
  protected signer: Signer;

  constructor() {
    super();

    this.signer = this.container.get('Signer');
  }

  @test()
  nonce() {
    const nonce = this.signer.generateNonce();

    expect(nonce.length).to.be.eq(32);
  }

  @test()
  verify_success() {
    const account = web3.eth.accounts.create();
    const nonce = this.signer.generateNonce();

    const signature = web3.eth.accounts.sign(nonce, account.privateKey);
    const isValid = this.signer.verify(nonce, signature.signature, account.address);

    expect(isValid).to.be.true;
  }

  @test()
  verify_failsWrongNonce() {
    const account = web3.eth.accounts.create();
    const nonceA = this.signer.generateNonce();
    const nonceB = this.signer.generateNonce();

    const signature = web3.eth.accounts.sign(nonceB, account.privateKey);
    const isValid = this.signer.verify(nonceA, signature.signature, account.address);

    expect(isValid).to.be.false;
  }
}
