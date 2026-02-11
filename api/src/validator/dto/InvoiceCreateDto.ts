import {IsNumber} from 'class-validator';

export class InvoiceCreateDto {
  @IsNumber()
  fromUnix: number;

  @IsNumber()
  toUnix: number;
}
