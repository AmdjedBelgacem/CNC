import { Controller, Get, Query } from '@nestjs/common';
import { StudyGroupsService } from './study-groups.service';

@Controller('social/groups')
export class StudyGroupsController {
  constructor(private svc: StudyGroupsService) {}

  @Get()
  async findAll(@Query('academy') academy?: string) {
    return { data: await this.svc.findAll(academy) };
  }
}
