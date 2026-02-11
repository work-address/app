import {IsObject} from 'class-validator';
import {SearchDto} from './SearchDto';

export class InvoiceSearchDto extends SearchDto {
  @IsObject()
  filter: {
    activityId: string;
  };
}
