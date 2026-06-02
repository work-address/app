import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm'
import faker from 'faker'
import { Exclude, Expose, Type } from 'class-transformer'
import { JSONSchema } from 'class-validator-jsonschema'
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator'

import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { Project } from '@/entity/project'
import {
  EProjectStatisticsPeriod,
  IProjectStatistics,
} from '@/model/project-statistics'

@JSONSchema({
  example: {
    id: faker.datatype.uuid(),
  },
})
@Entity('project_statistics')
@Exclude()
@Unique('UQ_PROJECT_STATISTICS_PROJECT_PERIOD_NAME', [
  'project',
  'period',
  'processName',
])
export class ProjectStatistics
  extends AbstractBaseEntity
  implements IProjectStatistics
{
  @Type(() => Project)
  @ManyToOne(() => Project, { eager: true, nullable: false })
  @JoinColumn({ name: 'projectId' })
  project: Project

  @IsNotEmpty()
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: false })
  @IsString()
  processName: string

  @Expose({ groups: ['search'] })
  @Column('int', { nullable: false, default: 0 })
  @IsNumber()
  timeMin: number

  @IsNotEmpty()
  @Expose({ groups: ['search'] })
  @Column('text', { nullable: false })
  @IsEnum(EProjectStatisticsPeriod)
  period: EProjectStatisticsPeriod
}
