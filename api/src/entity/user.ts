import { Entity, Column, Index, OneToMany } from 'typeorm'
import { faker } from '@faker-js/faker'
import { JSONSchema } from 'class-validator-jsonschema'
import { Exclude, Expose } from 'class-transformer'

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator'
import { AbstractBaseEntity } from '@/entity/abstract-base-entity'
import { EmailOrPhoneConstraint } from '@/entity/constraint/email-or-phone-constraint'
import { PhoneConstraint } from '@/entity/constraint/phone-constraint'
import { EmailConstraint } from '@/entity/constraint/email-constraint'
import { EUserRole } from '@/model/user'
import { IUser } from '@/model/user'
import { Project } from '@/entity/project'

// TODO: add profile visibility flag, so user can hide their profile from the public
@JSONSchema({
  example: {
    id: faker.string.uuid(),
  },
})
@Entity()
@Exclude()
export class User extends AbstractBaseEntity implements IUser {
  @Expose({ groups: ['search', 'register'] })
  @Column('text', { unique: true })
  @IsString()
  @IsOptional()
  address: string

  @Expose({ groups: ['search', 'edit', 'register'] })
  @Validate(EmailOrPhoneConstraint, [], { groups: ['register'] })
  emailOrPhone: string

  @Expose({ groups: ['search', 'edit'] })
  @Index({ unique: true })
  @Validate(EmailConstraint, [], {
    groups: ['search', 'edit'],
  })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  @IsOptional({ groups: ['edit'] })
  email: string

  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @Validate(PhoneConstraint, [], {
    groups: ['search', 'edit'],
  })
  @IsOptional({ groups: ['edit'] })
  @IsString()
  @IsOptional()
  @Index({ unique: true })
  phone: string

  // Professional Information
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  name: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  title: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  company: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  bio: string
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('decimal', { precision: 6, scale: 2, default: 0, nullable: true })
  @IsString()
  @IsOptional()
  rate: number
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  skills: string

  // Social
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  facebook: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  linkedIn: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  twitter: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  instagram: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  youtube: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  telegram: string
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  whatsapp: string

  // Location
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  tz: string
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  city: string

  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  country: string

  @OneToMany(() => Project, (project) => project.user)
  projects: Project[]
  @Expose({ groups: ['search', 'edit'] })
  @Column('text', { array: true })
  @IsArray()
  @IsEnum(EUserRole, { each: true })
  @IsOptional()
  roles: EUserRole[] = []

  // Not exposed to the 'edit' group - premium is granted by billing, not
  // self-editable via PUT /user.
  @Expose({ groups: ['search'] })
  @Column('bool', { nullable: true, default: false })
  @IsBoolean()
  @IsOptional()
  premium?: boolean | null
}
