import faker from 'faker';
import {inject, injectable} from 'inversify';
import {Activity} from '../../entity/Activity';
import {User} from '../../entity/User';

import {ProposalRepository} from '../../repository/ProposalRepository';
import {Proposal} from '../../entity/Proposal';

@injectable()
export class ProposalFixture {
  @inject('ProposalRepository')
  protected proposalRepository: ProposalRepository;

  public create(activity: Activity, user: User): Promise<Proposal> {
    const proposal = new Proposal();

    proposal.activity = activity;
    proposal.text = faker.datatype.uuid();
    proposal.rate = faker.datatype.number();
    proposal.user = user;

    return this.proposalRepository.saveSingle(proposal);
  }
}
