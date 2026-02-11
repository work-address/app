import {IsObject} from 'class-validator';
import {SearchDto} from './SearchDto';

export class TimeSearchDto extends SearchDto {
  @IsObject()
  filter: {
    activityId: string;
    fromAt: number;
    toAt: number;
  };
}
