import {suite} from '@testdeck/mocha';

import {AbstractDatabaseIntegration} from '../AbstractDatabase.integration';
import {TonProofService} from '../../service/auth/TonProofService';

@suite()
export class TonProofServiceTest extends AbstractDatabaseIntegration {
  protected tonProofService: TonProofService;

  constructor() {
    super();

    this.tonProofService = this.container.get('TonProofService');
  }
}
