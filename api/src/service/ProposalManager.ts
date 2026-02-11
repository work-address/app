import {inject, injectable} from 'inversify';

import {ProposalRepository} from '../repository/ProposalRepository';
import {Proposal} from '../entity/Proposal';
import {ActivityRepository} from '../repository/ActivityRepository';
import ProposalException from '../exception/ProposalException';

@injectable()
export class ProposalManager {
  @inject('ProposalRepository')
  protected proposalRepository: ProposalRepository;
  @inject('ActivityRepository')
  protected activityRepository: ActivityRepository;

  public save(proposal: Proposal) {
    return this.proposalRepository.validateAndSave(proposal);
  }

  public async edit(proposal: Proposal, data: Proposal) {
    const activityWithProposal = await this.activityRepository.findActivityByProposalAccepted(
      proposal
    );

    if (activityWithProposal) {
      throw new ProposalException('Proposal was accepted and can not be edited');
    }

    proposal = Object.assign(proposal, data);

    return this.proposalRepository.validateAndSave(proposal);
  }
}
