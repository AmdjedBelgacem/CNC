import { Controller, Get } from '@nestjs/common';
import { TitanTvService } from './titan-tv.service';

@Controller('titan-tv')
export class TitanTvController {
  constructor(private svc: TitanTvService) {}

  @Get()
  async findAll() {
    return { data: await this.svc.findAll() };
  }
}
