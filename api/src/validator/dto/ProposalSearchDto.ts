import {IsObject} from 'class-validator';
import {SearchDto} from './SearchDto';

export class ProposalSearchDto extends SearchDto {
  @IsObject()
  filter: {
    activityId: string;
  };
}
