import {IsObject} from 'class-validator';
import {SearchDto} from './search-dto';

export class InvoiceSearchDto extends SearchDto {
  @IsObject()
  filter: {
    projectId: string;
  };
}
