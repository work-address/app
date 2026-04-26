import faker from 'faker';
import {injectable} from 'inversify';
import {getRepository} from 'typeorm';
import {Activity} from '../../entity/Activity';
import {User} from '../../entity/User';
import {Proposal} from '../../entity/Proposal';

@injectable()
export class ProposalFixture {
  public create(activity: Activity, user: User): Promise<Proposal> {
    const proposal = new Proposal();

    proposal.activity = activity;
    proposal.text = faker.datatype.uuid();
    proposal.rate = faker.datatype.number();
    proposal.user = user;

    return getRepository(Proposal).save(proposal);
  }
}
