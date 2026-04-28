import { IsObject } from 'class-validator'
import { SearchDto } from '@/validator/dto/search-dto'
import { EProjectState } from '@/interface/project'

export class ProjectSearchDto extends SearchDto {
  @IsObject()
  filter: {
    userId?: string
    state?: EProjectState
    projectId?: string
  }
}
