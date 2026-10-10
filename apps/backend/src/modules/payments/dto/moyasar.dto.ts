import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { OrderItemType } from '../../../database/schema/orders';
import { MAX_LINES, MAX_QUANTITY } from '../moyasar.service';

/**
 * Item kinds an order line may reference.
 *
 * Mirrors the `OrderItemType` union exactly. This previously listed `event` instead of
 * `event_ticket` and omitted `custom`, so a legitimate event ticket would have been rejected by
 * validation even though the service handles it.
 */
const ITEM_TYPES: OrderItemType[] = ['course', 'product', 'event_ticket', 'bundle', 'custom'];

export class CheckoutLineDto {
  @ApiProperty()
  @IsIn(ITEM_TYPES, {
    message: `itemType must be one of ${ITEM_TYPES.join(', ')}`,
  })
  itemType: OrderItemType;

  /**
   * A real UUID, validated before it reaches the database.
   *
   * This was an untyped `string`, so `refId: "x"` went straight into a `where id = $1` clause and
   * Postgres rejected it with `invalid input syntax for type uuid`. That surfaced as an opaque
   * HTTP 500, telling the caller the server was broken when in fact their request was malformed.
   */
  @IsUUID(undefined, { message: 'refId must be a valid id' })
  refId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(MAX_QUANTITY, { message: `quantity may not exceed ${MAX_QUANTITY}` })
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'variantId must be a valid id' })
  variantId?: string;
}

export class CreateMoyasarOrderDto {
  @ApiProperty({ type: [CheckoutLineDto] })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, { message: `an order may contain at most ${MAX_LINES} lines` })
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  lines: CheckoutLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelUrl?: string;
}
