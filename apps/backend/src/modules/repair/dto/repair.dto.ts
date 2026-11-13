import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

const HTTPS_URL = { protocols: ['https'], require_protocol: true };

/**
 * Writable columns of `repair_shops`. `tenantId` comes from the request tenant, and
 * `rating` / `reviewCount` are derived, so none of them is accepted from the body.
 */
export class CreateRepairShopDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  specialties?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  servicesOffered?: string[];

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, string>;

  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl(HTTPS_URL, { each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRepairShopDto extends PartialType(CreateRepairShopDto) {}

/** Writable keys, copied one by one so a body can never reach `id`/`tenantId`/`rating`. */
export const REPAIR_SHOP_WRITABLE_KEYS = [
  'name', 'description', 'category', 'address', 'city', 'state', 'lat', 'lng', 'phone',
  'website', 'email', 'specialties', 'servicesOffered', 'businessHours', 'logoUrl',
  'photoUrls', 'isVerified', 'isActive',
] as const satisfies readonly (keyof CreateRepairShopDto)[];
