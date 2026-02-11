import {TimeCreateDto} from '../validator/dto/TimeCreateDto';

export interface ITimeInsertionResult extends TimeCreateDto {
  id?: string;
  error?: {
    name: string;
    message: string;
    errors?: any;
  };
}
