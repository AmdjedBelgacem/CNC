import { Module } from '@nestjs/common';
import { TitanTvController } from './titan-tv.controller';
import { TitanTvService } from './titan-tv.service';

@Module({
  controllers: [TitanTvController],
  providers: [TitanTvService],
})
export class TitanTvModule {}
