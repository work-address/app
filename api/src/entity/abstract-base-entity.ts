import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import {Expose} from 'class-transformer';
import {IsOptional, IsDate, IsNotEmpty, IsUUID} from 'class-validator';

export abstract class AbstractBaseEntity {
  @Expose({groups: ['search', 'create']})
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  @IsOptional()
  @IsNotEmpty()
  id: string;

  @Expose({groups: ['search']})
  @Column('timestamptz')
  @CreateDateColumn()
  @Index()
  @IsDate()
  @IsOptional()
  createdAt: Date;

  @Expose({groups: ['search']})
  @Column('timestamptz')
  @UpdateDateColumn()
  @Index()
  @IsDate()
  @IsOptional()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
