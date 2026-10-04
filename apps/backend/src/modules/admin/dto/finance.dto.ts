import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
  status!: string;
}

export class CreateBudgetDto {
  @IsIn(['month', 'quarter', 'year'])
  period!: 'month' | 'quarter' | 'year';

  @IsIn(['revenue', 'ops', 'marketing', 'product', 'other'])
  category!: 'revenue' | 'ops' | 'marketing' | 'product' | 'other';

  @IsNumber()
  @Min(0)
  targetCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateBudgetDto extends CreateBudgetDto {}
