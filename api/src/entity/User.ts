import {Entity, Column, Index, BeforeUpdate, BeforeInsert, OneToMany} from 'typeorm';
import * as faker from 'faker';
import {JSONSchema} from 'class-validator-jsonschema';
import {Exclude, Expose} from 'class-transformer';

import {IsOptional, IsString, Validate} from 'class-validator';
import {AbstractBaseEntity} from './AbstractBaseEntity';
import {UserNameExistConstraint} from '../validator/constraint/UserNameExistConstraint';
import {EmailOrPhoneConstraint} from '../validator/constraint/EmailOrPhoneConstraint';
import {PhoneConstraint} from '../validator/constraint/PhoneConstraint';
import {EmailConstraint} from '../validator/constraint/EmailConstraint';
import {EUserRole} from '../interface/EUserRole';
import {IUser} from '../interface/IUser';
import {Activity} from './Activity';
import {Proposal} from './Proposal';

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

  // General
  @Expose({groups: ['search', 'edit']})
  @Validate(UserNameExistConstraint, [], {groups: ['invite']})
  @Column('text', {nullable: true, unique: true})
  @IsString()
  @IsOptional()
  userName: string;

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

  @OneToMany(() => Activity, activity => activity.user)
  activities: Activity[];
  @OneToMany(() => Proposal, proposal => proposal.user)
  proposals: Proposal[];

  @Expose({groups: ['search']})
  @Column('integer', {nullable: true})
  activitiesCount: number;

  @Expose({groups: ['search', 'edit']})
  @Column('text', {nullable: true})
  @IsString()
  @IsOptional()
  tz: string;
  @Expose({groups: ['search', 'edit']})
  @Column('text', {array: true})
  roles: EUserRole[] = [];

  @Column('text', {nullable: true})
  resetPasswordJwtIat: string | null;
  @Column('text', {nullable: true})
  query: string;

  //Notifications
  @Expose({groups: ['search', 'edit']})
  @Column('bool', {nullable: true, default: true})
  isAlertActivities: boolean;
  @Expose({groups: ['search', 'edit']})
  @Column('bool', {nullable: true, default: true})
  isAlertMessages: boolean;
  @Expose({groups: ['search', 'edit']})
  @Column('bool', {nullable: true, default: true})
  isEmailNewsletter: boolean;

  @Expose({name: 'name', groups: ['search']})
  name() {
    return this.userName || this.id;
  }

  hasRole(role: EUserRole): boolean {
    return this.roles.indexOf(role) > -1;
  }

  @BeforeInsert()
  @BeforeUpdate()
  setQuery() {
    if (this.email) {
      this.query = `${this.email.toLowerCase()}`.toLowerCase();
    }
    if (this.phone) {
      this.query = `${this.phone.toLowerCase()}`.toLowerCase();
    }
  }
}
