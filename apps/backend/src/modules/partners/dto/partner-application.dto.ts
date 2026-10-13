import { IsString, IsOptional, IsEmail, IsEnum, MaxLength, MinLength, IsObject, IsInt, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartnerApplicationDto {
  @IsEnum(['sponsor', 'distributor', 'training_center', 'affiliate', 'other'])
  type!: string;

  @IsString() @MinLength(2) @MaxLength(200)
  companyName!: string;

  @IsString() @MinLength(2) @MaxLength(200)
  contactName!: string;

  @IsEmail() @MaxLength(320)
  email!: string;

  @IsOptional() @IsString() @MaxLength(500)
  website?: string;

  @IsOptional() @IsString() @MaxLength(60)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(100)
  country?: string;

  @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @IsString() @MinLength(10) @MaxLength(5000)
  message!: string;

  @IsOptional() @IsString() @MaxLength(100)
  audienceSize?: string;

  @IsOptional() @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional() @IsObject()
  source?: Record<string, unknown>;

  @IsOptional() @IsString() @MaxLength(100)
  botField?: string; // honeypot
}

export class AdminListApplicationsQuery {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  limit?: number;
}

export class UpdatePartnerApplicationDto {
  @IsOptional() @IsEnum(['pending', 'under_review', 'approved', 'rejected', 'needs_info'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  adminNotes?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  rejectionReason?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  infoRequestMessage?: string;

  @IsOptional() @IsUUID()
  assignedReviewerId?: string;
}
