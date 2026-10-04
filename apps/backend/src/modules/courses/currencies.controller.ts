import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { FxRatesService } from './fx-rates.service';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly fxRates: FxRatesService) {}

  @Public()
  @TenantScoped()
  @Get()
  @ApiOperation({ summary: 'Get supported currencies and cached live exchange rates' })
  getRates(@Query('base') base?: string) {
    return this.fxRates.getRates(base);
  }
}
