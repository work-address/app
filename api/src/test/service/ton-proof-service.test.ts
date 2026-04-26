import {suite} from '@testdeck/mocha';

import {AbstractDatabaseIntegration} from '../abstract-database.integration';
import {TonProofService} from '../../service/auth/ton-proof-service';

@suite()
export class TonProofServiceTest extends AbstractDatabaseIntegration {
  protected tonProofService: TonProofService;

  constructor() {
    super();

    this.tonProofService = this.container.get('TonProofService');
  }
}
