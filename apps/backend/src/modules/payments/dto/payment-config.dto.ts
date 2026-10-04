import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class UpdatePaymentConfigDto {
  /** Safe to expose; required for the browser form to render. */
  @IsOptional()
  @IsString()
  @Length(8, 200)
  publishableKey?: string;

  /** Write-only. A blank value keeps the stored key. */
  @IsOptional()
  @IsString()
  @Length(8, 500)
  secretKey?: string;

  @IsOptional()
  @IsBoolean()
  clearSecretKey?: boolean;

  /** Shared secret used to authenticate Moyasar webhooks. */
  @IsOptional()
  @IsString()
  @Length(8, 500)
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearWebhookSecret?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  liveMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  successUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelUrl?: string;
}
