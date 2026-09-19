import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private quotes: QuotesService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a B2B quote request' })
  create(@Body() body: { name: string; email: string; company: string; message?: string }) {
    return this.quotes.create(body);
  }
}
