import {UnauthorizedError} from 'routing-controllers';

class ProposalException extends UnauthorizedError {
  public static NAME = 'ProposalException';

  constructor(message: string) {
    super(`Proposal error: ${message}`);

    Object.setPrototypeOf(this, ProposalException.prototype);
    this.name = ProposalException.NAME;
    this.message = `Proposal error: ${message}`;
  }
}

export default ProposalException;
