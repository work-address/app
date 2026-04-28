import {Entity, Column, Index, OneToMany} from 'typeorm';
import * as faker from 'faker';
import {JSONSchema} from 'class-validator-jsonschema';
import {Exclude, Expose} from 'class-transformer';

import {IsOptional, IsString, Validate} from 'class-validator';
import {AbstractBaseEntity} from './abstract-base-entity';
import {EmailOrPhoneConstraint} from '../validator/constraint/email-or-phone-constraint';
import {PhoneConstraint} from '../validator/constraint/phone-constraint';
import {EmailConstraint} from '../validator/constraint/email-constraint';
import {EUserRole} from '../interface/user';
import {IUser} from '../interface/user';
import {Project} from './project';

// TODO: add profile visibility flag, so user can hide their profile from the public
@JSONSchema({
  example: {
    id: faker.datatype.uuid(),
  },
})
@Entity()
@Exclude()
export class User extends AbstractBaseEntity implements IUser {
  @Expose({groups: ['search', 'register']})
  @Column('text', {unique: true})
  @IsString()
  @IsOptional()
  address: string;

  @Expose({groups: ['search', 'edit', 'register']})
  @Validate(EmailOrPhoneConstraint, [], {groups: ['register']})
  emailOrPhone: string;

  @Expose({groups: ['search', 'edit']})
  @Index({unique: true})
  @Validate(EmailConstraint, [], {
    groups: ['search', 'edit'],
  })
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  @IsOptional({groups: ['edit']})
  email: string;

  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @Validate(PhoneConstraint, [], {
    groups: ['search', 'edit'],
  })
  @IsOptional({groups: ['edit']})
  @IsString()
  @IsOptional()
  @Index({unique: true})
  phone: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  company: string;

  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  bio: string;

  @Expose({groups: ['search', 'create', 'edit']})
  @Column('decimal', {precision: 6, scale: 2, default: 0, nullable: true})
  @IsString()
  @IsOptional()
  price: number;

  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  skills: string;

  // Social
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  facebook: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  linkedIn: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  twitter: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  instagram: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  youtube: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  telegram: string;
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  whatsapp: string;

  // Address
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  lat: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  lng: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  address1: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  address2: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  postalCode: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  city: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  region: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  country: string;

  @OneToMany(() => Project, project => project.user)
  projects: Project[];

  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  tz: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {array: true})
  roles: EUserRole[] = [];
}
