import {IsObject} from 'class-validator';
import {SearchDto} from './SearchDto';
import {EActivityState} from '../../interface/EActivityState';

export class ActivitySearchDto extends SearchDto {
  @IsObject()
  filter: {
    userId?: string;
    state?: EActivityState;
    keywords?: string[];
  };
}
