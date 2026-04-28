import { IsObject } from 'class-validator'
import { SearchDto } from '@/validator/dto/search-dto'

export class TimeSearchDto extends SearchDto {
  @IsObject()
  filter: {
    projectId: string
    fromAt: number
    toAt: number
  }
}
