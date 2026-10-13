import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { PartnersAdminController } from './partners-admin.controller';

@Module({
  providers: [PartnersService],
  controllers: [PartnersController, PartnersAdminController],
  exports: [PartnersService],
})
export class PartnersModule {}
