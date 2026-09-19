import { Module } from '@nestjs/common';
import { StudyGroupsController } from './study-groups.controller';
import { StudyGroupsService } from './study-groups.service';

@Module({
  controllers: [StudyGroupsController],
  providers: [StudyGroupsService],
})
export class StudyGroupsModule {}
