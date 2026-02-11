import {IsNumber, IsString, IsObject, IsOptional, IsNotEmpty} from 'class-validator';
import {ISearch} from '../../interface/search/ISearch';

export class SearchDto implements ISearch {
  @IsNumber()
  @IsNotEmpty()
  page: number;

  @IsObject()
  filter: any;

  @IsObject()
  sort: any;

  @IsString()
  @IsOptional()
  query: string;

  @IsNumber()
  @IsOptional()
  limit: number;
}
