import { IsObject } from 'class-validator'
import { SearchDto } from './search-dto'

export class TimeSearchDto extends SearchDto {
  @IsObject()
  filter: {
    projectId: string
    fromAt: number
    toAt: number
  }
}
