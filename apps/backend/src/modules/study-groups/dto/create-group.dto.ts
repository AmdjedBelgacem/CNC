import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * Body for creating a study group.
 *
 * The previous service took `data: any`, so every field arrived unvalidated and a missing `name`
 * surfaced as a 500 from the database layer instead of a 400. Coordinates are typed separately
 * because a lat/lng that are swapped or out of range put the pin in the ocean and the map is the
 * primary way people find a local group.
 */
export class CreateGroupDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * Free-text taxonomy string inherited from the old schema, not a foreign key to `academies`.
   * Kept as-is so existing seeded rows keep working; the list endpoint displays it verbatim.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  academy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

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
  @MaxLength(200)
  meetingSchedule?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(500)
  maxMembers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;
}

/**
 * Body for editing a group. `isActive` is deliberately here: a host needs a way to archive a
 * group without destroying the membership history, which is what `DELETE` does.
 *
 * Not `PartialType(CreateGroupDto)` — `PartialType` would also widen the `@Min(2)` on
 * `maxMembers`, which is the bound that keeps a group from being edited down below the number of
 * people already in it (that check lives in the service against the live member list).
 */
export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  academy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

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
  @MaxLength(200)
  meetingSchedule?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(500)
  maxMembers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
